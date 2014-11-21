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

define(['./target', '../vendor/knockout', 'require', '../core/bus'], function (BaseTarget, ko, require, bus) {
  function Contact(id) {
    BaseTarget.call(this, id);

    var self = this;

    this.type = 'contact';

    this.nick = ko.observable();
    this.isOnline = ko.observable(false);
    this.state = {
      left: ko.observable('waiting'),
      right: ko.observable('waiting')
    };

    this.alias(bus.userStorage.get('contact.' + id + '.alias'));

    this.displayName = ko.pureComputed(function () {
      var alias = self.alias();

      return alias ? alias : self.nick();
    });

    this.alias.subscribe(function (newValue) {
      bus.userStorage.set('contact.' + id + '.alias', newValue);
    });
  }

  Contact.prototype = new BaseTarget();
  Contact.prototype.constructor = Contact;

  Contact.prototype.invokerId = null;

  return Contact;
});