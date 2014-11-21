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

define(['./target', '../vendor/knockout', '../core/bus'], function (BaseTarget, ko, bus) {
  function Group(id) {
    BaseTarget.call(this, id);

    var self = this;

    this.type = 'group';

    this.members = ko.observableArray();
    this.role = ko.observable();

    this.alias(bus.userStorage.get('contact.' + id + '.alias'));

    this.displayName = ko.pureComputed(function () {
      var alias = self.alias();

      return alias ? alias : 'group';
    });

    this.alias.subscribe(function (newValue) {
      bus.userStorage.set('contact.' + id + '.alias', newValue);
    });
  }

  Group.prototype = new BaseTarget();
  Group.prototype.constructor = Group;

  return Group;
});