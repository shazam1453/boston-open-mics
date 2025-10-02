const pool = require('../config/database');

class RecurringEventTemplate {
  static async create({
    venueId,
    title,
    description,
    startTime,
    endTime,
    maxPerformers,
    performanceLength,
    eventType,
    dayOfWeek,
    signupOpensTime,
    signupDeadlineTime,
    signupOpensHoursBefore,
    signupDeadlineHoursBefore,
    createdBy
  }) {
    const query = `
      INSERT INTO recurring_event_templates (
        venue_id, title, description, start_time, end_time, max_performers,
        performance_length, event_type, day_of_week, signup_opens_time, signup_deadline_time,
        signup_opens_hours_before, signup_deadline_hours_before,
        created_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      RETURNING *
    `;
    
    const values = [
      venueId, title, description, startTime, endTime, maxPerformers,
      performanceLength, eventType, dayOfWeek, signupOpensTime, signupDeadlineTime,
      signupOpensHoursBefore, signupDeadlineHoursBefore, createdBy
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findByVenue(venueId) {
    const query = `
      SELECT rt.*, v.name as venue_name, u.name as created_by_name
      FROM recurring_event_templates rt
      LEFT JOIN venues v ON rt.venue_id = v.id
      LEFT JOIN users u ON rt.created_by = u.id
      WHERE rt.venue_id = $1 AND rt.is_active = true
      ORDER BY rt.created_at DESC
    `;
    
    const result = await pool.query(query, [venueId]);
    return result.rows;
  }

  static async findById(id) {
    const query = `
      SELECT rt.*, v.name as venue_name, u.name as created_by_name
      FROM recurring_event_templates rt
      LEFT JOIN venues v ON rt.venue_id = v.id
      LEFT JOIN users u ON rt.created_by = u.id
      WHERE rt.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) return null;

    values.push(id);
    const query = `
      UPDATE recurring_event_templates 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async deactivate(id) {
    const query = `
      UPDATE recurring_event_templates 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Generate next event date for weekly recurrence
  static getNextEventDate(template, fromDate = new Date()) {
    const date = new Date(fromDate);
    
    // Find next occurrence of the specified day of week
    const daysUntilNext = (template.day_of_week - date.getDay() + 7) % 7;
    if (daysUntilNext === 0) {
      // If today is the target day, check if we should use today or next week
      const eventDateTime = new Date(date);
      const [hours, minutes] = template.start_time.split(':');
      eventDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      if (eventDateTime <= fromDate) {
        // Event time has passed today, schedule for next week
        date.setDate(date.getDate() + 7);
      }
      // Otherwise use today
    } else {
      // Use the next occurrence of this day of week
      date.setDate(date.getDate() + daysUntilNext);
    }
    
    return date;
  }

  // Generate multiple future events from template
  static async generateEvents(templateId, numberOfEvents = 4) {
    const template = await this.findById(templateId);
    if (!template) throw new Error('Template not found');

    const events = [];
    let currentDate = new Date();
    
    for (let i = 0; i < numberOfEvents; i++) {
      const eventDate = this.getNextEventDate(template, currentDate);
      
      // Calculate signup times
      let signupOpens, signupDeadline;
      
      if (template.signup_opens_time) {
        // Use specific time on event date
        signupOpens = new Date(eventDate);
        const [openHours, openMinutes] = template.signup_opens_time.split(':');
        signupOpens.setHours(parseInt(openHours), parseInt(openMinutes), 0, 0);
      } else {
        // Use hours before event
        signupOpens = new Date(eventDate);
        signupOpens.setHours(signupOpens.getHours() - template.signup_opens_hours_before);
      }
      
      if (template.signup_deadline_time) {
        // Use specific time on event date
        signupDeadline = new Date(eventDate);
        const [deadlineHours, deadlineMinutes] = template.signup_deadline_time.split(':');
        signupDeadline.setHours(parseInt(deadlineHours), parseInt(deadlineMinutes), 0, 0);
      } else {
        // Use hours before event start
        signupDeadline = new Date(eventDate);
        const [hours, minutes] = template.start_time.split(':');
        signupDeadline.setHours(parseInt(hours) - template.signup_deadline_hours_before, parseInt(minutes));
      }
      
      const eventData = {
        title: template.title,
        description: template.description,
        venueId: template.venue_id,
        date: eventDate.toISOString().split('T')[0],
        startTime: template.start_time,
        endTime: template.end_time,
        maxPerformers: template.max_performers,
        performanceLength: template.performance_length,
        eventType: template.event_type,
        signupOpens: signupOpens.toISOString(),
        signupDeadline: signupDeadline.toISOString(),
        hostId: template.created_by,
        recurringTemplateId: template.id
      };
      
      events.push(eventData);
      
      // Move to next period for next iteration
      currentDate = new Date(eventDate);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return events;
  }
}

module.exports = RecurringEventTemplate;