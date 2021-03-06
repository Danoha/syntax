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

define(
  [
    './base', '../app', '../vendor/knockout', '../vendor/bootbox', './account', '../lib/storage',
    '../utils/waitdialog', '../lib/api', 'jquery', 'require', '../core/socket', '../lib/messagemanager',
    '../models/contactlist', '../models/target', '../core/apptitle', '../core/bus', '../core/notificator',
    '../core/focus', '../modals/settings', '../lib/embedmanager', '../modals/groupmembers', '../lib/throttler',
    '../utils/ko.bindings'
  ],
  function (BaseScreen, app, ko, bootbox, accountScreen, storage, WaitDialog, api, $, require, socket,
            messageManager, contactList, BaseTarget, appTitle, bus, notificator, focus, SettingsModal,
            embedManager, GroupMembersModal, throttler) {
    var appScreen = new BaseScreen('.app', 'app');

    // Helper functions

    function initUser(user) {
      app.user = appScreen.user = user;
      bus.userStorage = storage.prefix('user-' + app.user.id);
    }

    function updateTitle() {
      var sum = 0;

      $.each(appScreen.contactList.all(), function (i, c) {
        sum += c.unreadMessages();
      });

      appTitle.data.unread = sum;
    }

    function closeTarget() {
      var target = appScreen.target();

      if (target !== null) {
        var e = getMessagesPanelBody();

        target.scroll = {
          top: e.scrollTop(),
          left: e.scrollLeft()
        };

        appScreen.target(null);
        _messagesPanelBody = null;
      }
    }

    function openTarget(target) {
      closeTarget();

      appScreen.target(target);

      if (target.scroll !== null) {
        var e = getMessagesPanelBody();
        e.scrollTop(target.scroll.top).scrollLeft(target.scroll.left);
      }
    }

    function isTargetActive(target) {
      return appScreen.target() === target;
    }

    function syncContactList() {
      contactList.sync(app.user.id, app.user.contacts, app.user.groups);

      if (!contactList.isValidTarget(appScreen.target()))
        closeTarget();
    }

    function toggleNotifications() {
      if (!('Notification' in window)) {
        bootbox.alert('this browser does not support desktop notifications');
        return;
      }

      var n = window.Notification;

      var f = appScreen.panel.areNotificationsAllowed;
      var set = function (val) {
        f(val);

        bus.userStorage.set('notifications', val);
      };

      if (f()) {
        set(false);
        return;
      }

      if (n.permission === 'granted') {
        set(true);
        return;
      }

      var wait = new WaitDialog('waiting for notification permission');
      n.requestPermission(function (permission) {
        wait.close();

        if (!('permission' in n))
          n.permission = permission;

        if (permission === 'granted')
          set(true);
      });
    }

    function logout(disconnected) {
      function doLogout() {
        storage.remove('loginToken');

        appScreen.hide();
        accountScreen.show();
      }

      if (disconnected === true)
        doLogout();
      else {
        bootbox.confirm('do you really want to logout?', function (result) {
          if (result) {
            var wait = new WaitDialog('logging out');

            api.account.logout(function () {
              wait.close();
              doLogout();
            });
          }
        });
      }
    }

    function toggleFriendSearch() {
      var visible = appScreen.friendSearch.visible;

      visible(!visible());

      if (visible()) {
        $('.panel.friend-search input[type=text]').focus();
        resetFriendSearch();
      }
    }

    function doFriendSearch() {
      var query = appScreen.friendSearch.query();
      var wait = new WaitDialog('searching');

      api.contact.lookup(query, function (results) {
        wait.close();

        results = $.grep(results, function (user) {
          if (app.user.id === user.id)
            return false;

          var contact = contactList.findContact(user.id);

          return contact === null || contact.state.left() !== 'accepted';
        });

        appScreen.friendSearch.results(results);
      });
    }

    function contactsCreateGroup() {
      var wait = new WaitDialog('creating group');

      api.group.create(function (result) {
        wait.close();

        var g = {
          id: result.groupId,
          role: 'admin',
          members: []
        };

        app.user.groups.push(g);

        syncContactList();

        var group = contactList.findGroup(g.id);
        openTarget(group);

        messageManager.systemMessage(group, 'group created');
      });
    }

    function contactListEnum() {
      var contacts = appScreen.contactList.contacts();
      var groups = appScreen.contactList.groups();

      var alphaSort = function (a, b) {
        a = a.displayName();
        b = b.displayName();

        return a == b ? 0 : +(a > b) || -1;
      };

      groups.sort(alphaSort);
      contacts.sort(alphaSort);

      return groups.concat(contacts);
    }

    function closeEmbed() {
      appScreen.embed.title(null);
      appScreen.embed.html(null);
    }

    function resetFriendSearch() {
      appScreen.friendSearch.results([]);
      appScreen.friendSearch.query('');
    }

    function sendFriendRequest(user) {
      var wait = new WaitDialog('sending friend request');
      api.contact.setFriendshipState(user.id, 'accepted', false, function (result) {
        wait.close();

        if (result !== 'OK')
          bootbox.alert('something went wrong');
        else {
          appScreen.friendSearch.results.remove(user);

          var f = null;
          $.each(app.user.contacts, function (i, c) {
            if (c.id === user.id) {
              c.state.left = 'accepted';
              f = c;
            }
          });

          if (f === null) {
            f = {
              id: user.id,
              nick: user.nick,
              state: {
                left: 'accepted',
                right: 'waiting'
              }
            };

            app.user.contacts.push(f);
          }

          syncContactList();
          toggleFriendSearch();

          contactList.query({
            id: user.id,
            type: 'contact'
          }, function (target) {
            openTarget(target);
          });
        }
      });
    }

    function friendResponse(target, state) {
      var wait = new WaitDialog('sending response');

      api.contact.setFriendshipState(target.id, state, target.isFavorite(), function (result) {
        wait.close();

        if (result === 'OK')
          setFriendshipState(target.id, state);
        else
          bootbox.alert('something went wrong');
      });
    }

    function friendResponseAccepted() {
      friendResponse(appScreen.target(), 'accepted');
    }

    function friendResponseNotNow() {
      friendResponse(appScreen.target(), 'none');
    }

    function friendResponseDenied() {
      friendResponse(appScreen.target(), 'denied');
    }

    function setFriendshipState(id, lstate, rstate) {
      if (lstate !== 'none') {
        $.each(app.user.contacts, function (i, c) {
          if (c.id === id) {
            if (lstate)
              c.state.left = lstate;
            if (rstate)
              c.state.right = rstate;
          }
        });
      } else {
        app.user.contacts = $.grep(app.user.contacts, function (c) {
          return c.id !== id;
        });
      }

      syncContactList();
    }

    function setFriendOnline(id, online) {
      $.each(app.user.contacts, function (i, f) {
        if (f.id === id)
          f.isOnline = online;
      });

      // do not use syncContactList() because it's overkill
      $.each(appScreen.contactList.contacts(), function (i, f) {
        if (f.id === id)
          f.isOnline(online);
      });
    }

    function groupLeave() {
      var cb = function (notAgain) {
        var wait = new WaitDialog('leaving group');
        var group = appScreen.target();

        api.group.leave(group.id, notAgain, function (result) {
          wait.close();

          if (result !== 'OK') {
            bootbox.alert('something went wrong');
            return;
          }

          var fun;
          if (notAgain) {
            fun = function (g) {
              if (g.id === group.id)
                g.doNotInviteAgain = true;

              return true;
            };
          }
          else {
            fun = function (g) {
              return g.id !== group.id;
            };
          }

          app.user.groups = $.grep(app.user.groups, fun);
          syncContactList();
        });
      };

      bootbox.dialog({
        message: 'do you really want to leave this group?',
        buttons: {
          cancel: {
            label: 'no',
            className: 'btn-default'
          },
          yes: {
            label: 'yes',
            className: 'btn-warning',
            callback: function () {
              cb(false);
            }
          },
          dnia: {
            label: 'do not invite me again',
            className: 'btn-danger',
            callback: function () {
              cb(true);
            }
          }
        }
      });
    }

    var _messagesPanelBody = null;

    function getMessagesPanelBody() {
      if (_messagesPanelBody === null || _messagesPanelBody.length === 0)
        _messagesPanelBody = $('div.app .messages > .panel-body');

      return _messagesPanelBody;
    }

    function doProcessMessageScroll() {
      var target = appScreen.target();

      if (target === null)
        return;

      var el = getMessagesPanelBody();
      var bottom = el.height();
      var skip = target.lastReadMessage();

      //console.log('bottom:', bottom, 'skip:', skip);

      $(target.messages).children().slice(skip).each(function (i) {
        var msg = $(this);
        var b = msg.position().top + msg.outerHeight() - 75;

        if (bottom >= b) {
          target.lastReadMessage(skip + i + 1);
          //console.log('bottom of message:', b);
        }
        else
          return false;
      });
    }

    var processMessageScroll = throttler(doProcessMessageScroll, 200, true);

    var isAutoScrollDisabledByScrolling = false;

    function updateAutoScroll() {
      var el = getMessagesPanelBody();

      if (el.length === 0)
        return;

      //var prev = isAutoScrollDisabledByScrolling;

      var maxScrollTop = el.prop('scrollHeight') - el.outerHeight();
      isAutoScrollDisabledByScrolling = Math.abs(el.scrollTop() - maxScrollTop) > 1;

      //console.log('autoscroll prev:', !prev, 'scrollTop:', el.scrollTop(), 'maxScrollTop:', maxScrollTop, 'new:', !isAutoScrollDisabledByScrolling);
    }

    var isNextScrollEventIgnored = false;

    function messagesScrollHandler() {
      if (isNextScrollEventIgnored) {
        isNextScrollEventIgnored = false;
        return;
      }

      processMessageScroll();
      updateAutoScroll();
    }

    function scrollMessagesDown() {
      var el = getMessagesPanelBody();
      el.scrollTop(el.prop('scrollHeight') - el.outerHeight());
    }

    function bindMessagesEvents() {
      getMessagesPanelBody()
        .off('scroll', messagesScrollHandler)
        .on('scroll', messagesScrollHandler);

      $('.messages .composer textarea')
        .off('focus', processMessageScroll)
        .on('focus', processMessageScroll);

      getMessagesPanelBody().tooltip({
        selector: '[data-imagepreview],[data-tooltiptext]',
        html: true,
        title: function () {
          var el = $(this);
          var html = '';

          if (el.is('[data-imagepreview]')) {
            var url = el.attr('data-imagepreview');
            var ext = url.split('.').pop();

            if (ext === 'webm' || ext === 'gifv') {
              html += '<div class="imagepreview"><video autoplay loop src="' + url + '" alt="video preview"></video></div>';
            } else
              html += '<div class="imagepreview"><img src="' + url + '" alt="image preview"></div>';
          }

          if (el.is('[data-tooltiptext]'))
            html += '<div class="tooltiptext">' + el.attr('data-tooltiptext') + '</div>';

          return html;
        },
        container: '.messages .panel-body',
        placement: 'auto right'
      });
    }

    function isComposerFocused() {
      return $('.composer textarea').is(':focus');
    }

    function scrollMessagesHideRead() {
      var target = appScreen.target();

      if (target === null)
        return;

      var firstUnreadIndex = target.lastReadMessage();

      if (firstUnreadIndex >= target.totalMessages())
        return;

      var el = getMessagesPanelBody();
      var firstUnread = $(target.messages).children().eq(firstUnreadIndex);
      var top = firstUnread.position().top;
      var scrollTop = el.scrollTop();

      isNextScrollEventIgnored = true;
      el.scrollTop(scrollTop + top - 100);
    }

    function processUnread(target, isOwn) {
      if (isTargetActive(target)) {
        var focused = isComposerFocused();

        if (isOwn)
          scrollMessagesDown();
        else {

          if (focused && !isAutoScrollDisabledByScrolling)
            scrollMessagesDown();

          if (focused)
            processMessageScroll();

          if (!isAutoScrollDisabledByScrolling)
            scrollMessagesHideRead();
        }
      }

      if (!focus.value) {
        notificator.showNotification({
          type: 'chat',
          count: appTitle.data.unread
        });
      }

      if (!focus.value || !isTargetActive(target)) {
        notificator.playSound({
          target: target,
          type: 'chat'
        });
      }
    }

    function showSettings() {
      var modal = new SettingsModal();
      modal.show();
    }

    function setVolume(value) {
      value = parseInt(value);
      appScreen.panel.soundVolume(value);
      bus.userStorage.set('sound-volume', value);
    }

    function groupShowMembers() {
      var group = appScreen.target();
      var modal = new GroupMembersModal(group);
      modal.show();
    }

    function renameTarget() {
      var target = appScreen.target();

      bootbox.prompt('enter new alias (leave empty for default name)', function (result) {
        if (result !== null)
          target.alias(result);
      });
    }

    function removeContact() {
      var target = appScreen.target();

      function cb(ban) {
        var wait = new WaitDialog('removing contact');
        var state = ban ? 'denied' : 'none';

        api.contact.setFriendshipState(target.id, state, false, function (result) {
          wait.close();

          if (result !== 'OK')
            bootbox.alert('something went wrong');
          else
            setFriendshipState(target.id, state);
        });
      }

      bootbox.dialog({
        message: 'do you really want to remove this contact?',
        buttons: {
          cancel: {
            label: 'no',
            className: 'btn-default'
          },
          yes: {
            label: 'yes',
            className: 'btn-warning',
            callback: function () {
              cb(false);
            }
          },
          ban: {
            label: 'ban',
            className: 'btn-danger',
            callback: function () {
              cb(true);
            }
          }
        }
      });
    }

    // Model definition

    appScreen.target = ko.observable(null);
    appScreen.closeTarget = closeTarget;
    appScreen.openTarget = openTarget;
    appScreen.isTargetActive = isTargetActive;

    appScreen.panel = {
      toggleNotifications: toggleNotifications,

      areNotificationsAllowed: ko.observable(false),
      soundVolume: ko.observable(50),

      menu: {
        settings: showSettings,
        logout: logout
      }
    };

    appScreen.friendSearch = {
      results: ko.observableArray(),
      query: ko.observable(''),
      visible: ko.observable(false),

      toggle: toggleFriendSearch,
      submit: doFriendSearch,
      sendRequest: sendFriendRequest
    };

    appScreen.contactList = {
      contacts: contactList.contacts,
      groups: contactList.groups,

      createGroup: contactsCreateGroup
    };

    appScreen.contactList.all = ko.computed(contactListEnum);

    appScreen.embed = {
      title: ko.observable(null),
      html: ko.observable(null),

      close: closeEmbed
    };

    appScreen.friendResponses = {
      sendAccepted: friendResponseAccepted,
      sendNotNow: friendResponseNotNow,
      sendDenied: friendResponseDenied
    };

    appScreen.groupMenu = {
      leave: groupLeave,
      showMembers: groupShowMembers,

      rename: renameTarget
    };

    appScreen.contactMenu = {
      remove: removeContact,

      rename: renameTarget
    };

    appScreen.isStorageAvailable = storage.isAvailable;

    // Bus bindings

    bus.subscribe('apptitle.update', function () {
      updateTitle();
    });

    bus.subscribe('app.focus', function (focus) {
      if (focus)
        processMessageScroll();
    });

    bus.subscribe('messages.processUnread', function (target) {
      processUnread(target);
    });

    bus.subscribe('messages.updateAutoScroll', function () {
      updateAutoScroll();
    });

    // Event bindings

    $(document).on('click', 'a.embed', function () {
      var embed = embedManager.format(this);

      if (embed === null)
        return;

      appScreen.embed.title(embed.title);
      appScreen.embed.html(embed.html);
      return false;
    });

    var ignoreNextUnload = false;
    $(document).on('click', 'a.ignore-unload', function () {
      ignoreNextUnload = true;
    });

    $(window).on('beforeunload', function () {
      if (ignoreNextUnload) {
        ignoreNextUnload = false;
        return;
      }

      if (app.user !== undefined)
        return 'Do you really want to exit?';
    });

    appScreen.panel.soundVolume.subscribe(function (value) {
      setVolume(value);
    }, {throttle: 10});

    appScreen.target.subscribe(function (value) {
      setTimeout(function () {
        bindMessagesEvents();

        if (value !== null) {
          scrollMessagesHideRead();

          processMessageScroll();
        }
      }, 10);
    });

    appScreen.contactList.all.subscribe(function () {
      updateTitle();
    });

    appScreen.onInit = function () {
      initUser(app.user);

      SettingsModal.setDefaults();

      var volume = bus.userStorage.get('sound-volume');
      if (volume === undefined)
        volume = 50;
      appScreen.panel.soundVolume(volume);

      if ('Notification' in window && bus.userStorage.get('notifications') && Notification.permission === "granted")
        toggleNotifications();

      syncContactList();
    };

    appScreen.onReset = function () {
      contactList.sync(0, [], []); // clear contact list

      appScreen.target(null);

      appScreen.panel.areNotificationsAllowed(false);
      appScreen.panel.soundVolume(50);

      appScreen.friendSearch.visible(false);
      resetFriendSearch();

      appScreen.embed.title(null);
      appScreen.embed.html(null);

      appScreen.user = undefined;
    };

    // API bindings

    api.message.receivedEvent.push(function (msg) {
      messageManager.processMessage(msg);

      updateTitle();
    });

    api.contact.onlineEvent.push(function (data) {
      if (typeof data !== 'object')
        return;

      setFriendOnline(data.contactId, data.isOnline);
    });

    api.contact.friendshipStateEvent.push(function (data) {
      var localContact = null;
      $.each(app.user.contacts, function (i, c) {
        if (c.id === data.contact.id) {
          localContact = c;
          return false;
        }
      });

      var wereFriends = localContact !== null && localContact.state.left === 'accepted' && localContact.state.right === 'accepted';

      if (localContact !== null) {
        localContact.state = data.state;
        localContact.isOnline = data.contact.isOnline;
      } else if (data.state.left !== 'denied') {
        localContact = data.contact;
        localContact.state = data.state;
        app.user.contacts.push(localContact);
      }

      syncContactList();

      if (!wereFriends && data.state.left === 'accepted' && data.state.right === 'accepted') {
        contactList.query({
          id: data.contact.id,
          type: 'contact'
        }, function (t) {
          messageManager.systemMessage(t, t.displayName() + ' is now your friend');
        });
      }
    });

    api.group.memberLeftEvent.push(function (data) {
      if (typeof data !== 'object')
        return;

      $.each(app.user.groups, function (i, g) {
        if (g.id !== data.groupId)
          return;

        g.members = $.grep(g.members, function (m) {
          return m.id !== data.memberId;
        });
      });

      var m = contactList.query({
        type: 'contact',
        id: data.memberId
      });

      syncContactList();

      var g = contactList.findGroup(data.groupId);

      if (g === null || m === null)
        return;

      messageManager.systemMessage(g, m.displayName() + ' left this group');
    });

    api.group.destroyEvent.push(function (data) {
      if (typeof data !== 'object')
        return;

      app.user.groups = $.grep(app.user.groups, function (g) {
        return g.id !== data.groupId;
      });

      syncContactList();
    });

    api.group.inviteEvent.push(function (data) {
      if (typeof data !== 'object')
        return;

      var afterSync;

      if (!data.member) { // current user is invited to group
        app.user.groups.push(data.group);

        afterSync = function () {
          contactList.query([{
            type: 'group',
            id: data.group.id
          }, {
            type: 'contact',
            id: data.inviterId
          }], function (group, inviter) {
            messageManager.systemMessage(group, inviter.displayName() + ' invited you to this group');
          });
        };
      }
      else { // someone invited someone in group where current user already is
        $.each(app.user.groups, function (i, g) {
          if (g.id !== data.groupId)
            return;

          g.members.push(data.member);
        });

        afterSync = function () {
          contactList.query([{
            type: 'group',
            id: data.groupId
          }, {
            type: 'contact',
            id: data.inviterId
          }, {
            type: 'contact',
            id: data.member.id
          }], function (group, inviter, user) {
            if (data.inviterId === app.user.id)
              inviter = app.user.nick;
            else
              inviter = inviter.displayName();

            messageManager.systemMessage(group, inviter + ' invited ' + user.displayName() + ' to this group');
          });
        };
      }

      syncContactList();
      afterSync();
    });

    // Socket event bindings

    var io = socket();

    io.on('reconnect', function () {
      if (app.user === undefined) // user not logged in
        return;

      var wait = new WaitDialog('restoring login');
      api.account.restoreLogin(app.user.loginToken, function (result) {
        wait.close();

        if (result === 'ERR_INVALID') {
          logout(true);
          bootbox.alert('could not restore your login');
        }
        else {
          initUser(result);

          if (storage.get('loginToken'))
            storage.set('loginToken', app.user.loginToken);

          syncContactList();
        }
      });
    });

    return appScreen;
  });