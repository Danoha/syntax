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

define(['../lib/storage', './sound', './bus'], function (storage, soundManager, bus) {
  function Notificator() {
  }

  function areNotificationsAllowed() {
    return bus.userStorage !== null && bus.userStorage.get('notifications') ? true : false;
  }

  function getSoundVolume() {
    var volume;
    if (bus.userStorage === null || (volume = bus.userStorage.get('sound-volume')) === undefined)
      volume = 100;

    return volume;
  }

  function chatNotification(data) {
    var count = data.count;

    new Notification('syntax', {
      body: 'you have ' + count + ' unread message' + (count > 1 ? 's' : ''),
      tag: 'syntax_chat_unread',
      icon: 'img/syntax_64.png'
    });
  }

  function chatSound(data) {
    // TODO is data.target muted?

    soundManager.play('o-ou', getSoundVolume());
  }

  Notificator.prototype.showNotification = function (data) {
    if (!areNotificationsAllowed())
      return;

    switch (data.type) {
      case 'chat':
        chatNotification(data);
        break;
      default:
        throw new Error('Unknown notification type.');
    }
  };

  Notificator.prototype.playSound = function (data) {
    switch (data.type) {
      case 'chat':
        chatSound(data);
        break;
      default:
        throw new Error('Unknown sound type.');
    }
  };

  return new Notificator();
});