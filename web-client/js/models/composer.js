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

define(['../vendor/knockout', '../lib/api', 'jquery', '../app', '../modals/coder'], function (ko, api, $, app, CoderModal) {

  function getTextarea() {
    return $('.app .composer textarea');
  }

  function submit(composer, asCode) {
    var text = composer.text();
    if (text.trim().length === 0)
      return;

    composer.text('');

    if (asCode)
      text = text.replace(/^/gm, "  ");

    var msg = {
      text: text,
      instanceId: app.getUniqueId()
    };

    switch (composer.target.type) {
      case 'contact':
        msg.recipientId = composer.target.id;
        break;
      case 'group':
        msg.groupId = composer.target.id;
        break;
      default:
        throw new Error('Target type not supported');
    }

    api.message.send(msg); // TODO: enqueue unsent messages

    getTextarea().focus();
  }

  function keyPress(composer, event) {
    if ((event.which === 13 || event.keyCode === 13) && !event.shiftKey && !event.ctrlKey) {
      composer.submit(event.altKey);
      return false;
    }

    return true;
  }

  function Composer(target) {
    var self = this;

    this.target = target;
    this.text = ko.observable('');

    this.submit = function (asCode) {
      return submit(self, asCode);
    };

    this.keyPress = keyPress;
  }

  return Composer;
});