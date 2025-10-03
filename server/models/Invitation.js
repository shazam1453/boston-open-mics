const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const INVITATIONS_TABLE = process.env.INVITATIONS_TABLE;

class Invitation {
  static async create({ 
    eventId, 
    inviterId, 
    inviteeId, 
    type, // 'cohost' or 'performer'
    message = null 
  }) {
    const invitation = {
      id: uuidv4(),
      event_id: eventId,
      inviter_id: inviterId,
      invitee_id: inviteeId,
      type: type,
      message: message,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    await dynamodb.put({
      TableName: INVITATIONS_TABLE,
      Item: invitation
    }).promise();
    
    return invitation;
  }

  static async findByUser(userId) {
    const result = await dynamodb.query({
      TableName: INVITATIONS_TABLE,
      IndexName: 'InviteeIndex',
      KeyConditionExpression: 'invitee_id = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }).promise();
    
    // TODO: Add joins for event and user details
    // For now, return basic invitation data
    return result.Items || [];
  }

  static async findByEvent(eventId) {
    const result = await dynamodb.query({
      TableName: INVITATIONS_TABLE,
      IndexName: 'EventIndex',
      KeyConditionExpression: 'event_id = :eventId',
      ExpressionAttributeValues: {
        ':eventId': eventId
      }
    }).promise();
    
    // TODO: Add joins for user details
    // For now, return basic invitation data
    return result.Items || [];
  }

  static async findById(id) {
    const result = await dynamodb.get({
      TableName: INVITATIONS_TABLE,
      Key: { id: id }
    }).promise();
    
    // TODO: Add joins for event and user details
    // For now, return basic invitation data
    return result.Item;
  }

  static async updateStatus(id, status, userId) {
    // First get the invitation to verify ownership and current status
    const invitation = await this.findById(id);
    
    if (!invitation) {
      throw new Error('Invitation not found');
    }
    
    if (invitation.invitee_id !== userId) {
      throw new Error('Unauthorized to respond to this invitation');
    }
    
    if (invitation.status !== 'pending') {
      throw new Error('Invitation already responded to');
    }

    // Update invitation status
    const updatedInvitation = {
      ...invitation,
      status: status,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await dynamodb.put({
      TableName: INVITATIONS_TABLE,
      Item: updatedInvitation
    }).promise();

    // TODO: If accepted, add the user to the appropriate role
    // This would require integration with Events/Signups tables
    
    return updatedInvitation;
  }

  static async delete(id, userId) {
    // First get the invitation to verify ownership
    const invitation = await this.findById(id);
    
    if (!invitation) {
      return null;
    }
    
    if (invitation.inviter_id !== userId && invitation.invitee_id !== userId) {
      return null;
    }

    await dynamodb.delete({
      TableName: INVITATIONS_TABLE,
      Key: { id: id }
    }).promise();
    
    return invitation;
  }

  static async checkExisting(eventId, inviteeId, type) {
    const result = await dynamodb.scan({
      TableName: INVITATIONS_TABLE,
      FilterExpression: 'event_id = :eventId AND invitee_id = :inviteeId AND #type = :type AND #status = :status',
      ExpressionAttributeNames: {
        '#type': 'type',
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':eventId': eventId,
        ':inviteeId': inviteeId,
        ':type': type,
        ':status': 'pending'
      }
    }).promise();
    
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  }
}

module.exports = Invitation;