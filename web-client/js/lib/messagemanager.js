/* 
 * Copyright (C) 2014 Danoha
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */

'use strict';

define(['../lib/messageformatter', '../models/contactlist', '../app', 'jquery', 'require', '../models/group', '../core/bus', '../core/focus'], function(messageFormatter, contactList, app, $, require, Group, bus, focus) {
  var MessageManager = function() {};

  function findContact(id) {
    if (id === app.user.id)
      return 'self';
    else
      return contactList.findContact(id);
  }

  function findMessageRecipient(msg) {
    if (msg.recipientId !== undefined)
      return findContact(msg.recipientId);
    else if (msg.groupId !== undefined)
      return contactList.findGroup(msg.groupId);

    throw new Error('Unsupported chat message type.');
  }

  function findMessageFlow(msg) {
    var sender = findContact(msg.senderId);
    var recipient = findMessageRecipient(msg);

    if (msg.groupId && !sender) { // group member not in contact list
      var group = contactList.findGroup(msg.groupId);

      if (group !== null) {
        $.each(group.members(), function(i, m) {
          if (m.id !== msg.senderId)
            return;

          sender = m;
        });
      }
    }

    if (!sender || !recipient)
      return null;

    return {
      sender: sender,
      recipient: recipient
    };
  }

  function putMessage(target, msg, isOwn) {
    bus.post('messages.updateAutoScroll');
    
    target.putMessage(msg, isOwn);
    
    bus.post('messages.processUnread', target, isOwn);
  }

  MessageManager.prototype.processMessage = function(msg) {
    var flow = findMessageFlow(msg);

    if (flow === null)
      return; // unknown sender or recipient
    
    var row = messageFormatter.format(msg, flow);

    var target;
    if (flow.sender === 'self' || flow.recipient instanceof Group)
      target = flow.recipient;
    else
      target = flow.sender;

    var isOwn = false;
    if(msg.instanceId === app.getUniqueId())
      isOwn = true;

    putMessage(target, row, isOwn);
  };

  MessageManager.prototype.systemMessage = function(target, text) {
    var row = messageFormatter.format(text);

    putMessage(target, row, true);
  };

  MessageManager.prototype.handleScroll = function(container) {
    console.log(container);
  };

  return new MessageManager();
});