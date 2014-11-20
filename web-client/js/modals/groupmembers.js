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

define([
  'jquery', '../vendor/bootbox', './base', '../models/contactlist', '../vendor/knockout', '../lib/api'
], function($, bootbox, BaseModal, contactList, ko, api) {

  function sortByDisplayName(arr) {
    arr.sort(function(a, b) {
      return a.displayName().localeCompare(b.displayName());
    });
  }

  function apply(group, members) {
    var start = group.members();
    var end = members;
    var nop = function() {};

    var add = $.grep(end, function(m) {return start.indexOf(m) < 0});
    var remove = $.grep(start, function(m) {return end.indexOf(m) < 0 });

    // TODO: remove

    $.each(add, function(i, m) {
      api.groupInvite(group.id, m.id, nop);
    });
  }

  function GroupMembersModal(group) {
    BaseModal.call(this, 'groupmembers');
    this.title(group.displayName() + ' members');

    var self = this;
    this.viewModel.members = ko.observableArray(group.members.slice(0));

    this.viewModel.contacts = ko.computed(function() {
      var ms = self.viewModel.members();
      return $.grep(contactList.contacts(), function(m) {
        return $.inArray(m, ms) < 0;
      });
    });

    this.viewModel.removeMember = function(m) {
      self.viewModel.members.remove(m);
    };

    this.viewModel.addMember = function(m) {
      self.viewModel.members.push(m);
    };

    this.viewModel.membersSorted = ko.computed(function() {
      var ms = self.viewModel.members();
      sortByDisplayName(ms);
      return ms;
    });

    this.viewModel.contactsSorted = ko.computed(function() {
      var cs = self.viewModel.contacts();
      sortByDisplayName(cs);
      return cs;
    });

    this.buttons.cancel = {
      label: 'cancel',
      className: 'btn-default'
    };

    this.buttons.apply = {
      label: 'OK',
      className: 'btn-primary',
      callback: function() {
        apply(group, self.viewModel.members());
      }
    };
  }

  $.extend(GroupMembersModal.prototype, BaseModal.prototype);
  GroupMembersModal.prototype.constructor = GroupMembersModal;

  return GroupMembersModal;
});