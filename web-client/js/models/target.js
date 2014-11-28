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

define(['../vendor/knockout', 'jquery', '../vendor/bootbox', './composer', '../core/bus'], function (ko, $, bootbox, Composer, bus) {
  var BaseTarget = function (id) {
    var self = this;

    this.id = id;
    this.composer = new Composer(this);
    this.messages = $('<div>').get(0);

    this.alias = ko.observable();
    this.lastReadMessage = ko.observable(0);
    this.totalMessages = ko.observable(0);

    this.totalMessages.subscribe(function () {
      var children = $(self.messages).children();
      if (children.last().hasClass('own'))
        self.lastReadMessage(self.totalMessages());
    });

    this.unreadMessages = ko.computed(function () {
      return self.totalMessages() - self.lastReadMessage();
    });

    this.isFavorite = ko.observable(false);

    this.unreadMessages.subscribe(function () {
      var children = $(self.messages).children();
      var i = self.lastReadMessage();
      children.slice(0, i).removeClass('unread');
      children.slice(i).addClass('unread');

      bus.post('apptitle.update');
    });
  };

  BaseTarget.prototype.id = 0;
  BaseTarget.prototype.scroll = null;

  BaseTarget.prototype.displayName = null;

  BaseTarget.prototype.putMessage = function (msg, isOwn) {
    if (isOwn)
      msg.addClass('own');

    $(this.messages).append(msg);

    this.totalMessages(this.totalMessages() + 1);
  };

  return BaseTarget;
});