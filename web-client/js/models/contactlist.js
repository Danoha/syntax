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

define(['exports', '../vendor/knockout', './contact', './group', 'jquery'], function (exports, ko, Contact, Group, $) {
  exports.contacts = ko.observableArray();
  exports.groups = ko.observableArray();

  exports.sync = function (friendlist, grouplist) {
    function removeInvalid(ids, obs) {
      var current = obs();
      for (var i = current.length - 1; i >= 0; i--) {
        if ($.inArray(current[i].id, ids) >= 0)
          continue;

        obs.splice(i, 1);
      }
    }

    var validIds = [];
    $.each(friendlist, function (i, f) {
      if ($.inArray(f.state.left, ['waiting', 'accepted']) === -1 || $.inArray(f.state.right, ['waiting', 'accepted']) === -1 || (f.state.left === 'waiting' && f.state.right === 'waiting'))
        return;

      var contact = exports.findOrCreateContact(f.id);
      contact.nick(f.nick);
      contact.isOnline(f.isOnline);
      contact.invokerId = f.invokerId;

      contact.state.left(f.state.left);
      contact.state.right(f.state.right);

      validIds.push(f.id);
    });

    removeInvalid(validIds, exports.contacts);

    validIds = [];
    $.each(grouplist, function (i, g) {
      if (g.doNotInviteAgain || g.isBanned)
        return;

      var group = exports.findOrCreateGroup(g.id);
      group.role(g.role);
      group.members([]);

      $.each(g.members, function (j, m) {
        var c = exports.findContact(m.id);

        if (c === null) {
          c = new Contact(m.id);
          c.nick(m.nick);
        }

        group.members.push(c);
      });

      validIds.push(g.id);
    });

    removeInvalid(validIds, exports.groups);
  };

  exports.query = function (query, callback) {
    var err = new Error('Invalid contactListQuery() call.');

    function invalid() {
      throw err;
    }

    function lookupContact(array, id) {
      var item = null;
      $.each(array, function (i, c) {
        if (c.id !== id)
          return;

        item = c;
        return false;
      });
      return item;
    }

    var data = [];

    function process(q) {
      if (!q.id)
        return invalid();

      var item = null;
      switch (q.type) {
        case 'contact':
          item = lookupContact(exports.contacts(), q.id);

          if (item === null) { // traverse groups to find contact which is not in user's contact list
            $.each(exports.groups(), function (i, g) {
              item = lookupContact(g.members(), q.id);

              if (item !== null)
                return false;
            });
          }

          break;
        case 'group':
          $.each(exports.groups(), function (i, g) {
            if (g.id !== q.id)
              return;

            item = g;
            return false;
          });
          break;
        default:
          invalid();
          return;
      }

      data.push(item);
    }

    if ($.isArray(query)) {
      $.each(query, function (i, q) {
        process(q);
      });
    }
    else
      process(query);

    if (callback)
      callback.apply(undefined, data);

    if (!$.isArray(query))
      data = data[0];

    return data;
  };

  function find(type, id) {
    return exports.query({
      type: type,
      id: id
    });
  }

  exports.findContact = function (id) {
    return find('contact', id);
  };

  exports.findGroup = function (id) {
    return find('group', id);
  };

  function findOrCreate(type, id, obs, constructor) {
    var item = find(type, id);

    if (item === null) {
      item = new constructor(id);
      obs.push(item);
    }

    return item;
  }

  exports.findOrCreateContact = function (id) {
    return findOrCreate('contact', id, exports.contacts, Contact);
  };

  exports.findOrCreateGroup = function (id) {
    return findOrCreate('group', id, exports.groups, Group);
  };

  exports.isValidTarget = function (item) {
    return exports.contacts.indexOf(item) >= 0 || exports.groups.indexOf(item) >= 0;
  };
});