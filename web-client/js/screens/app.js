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
    '../core/focus', '../modals/settings', '../lib/embedmanager',
    '../utils/ko.bindings'
  ],
  function(
    BaseScreen, app, ko, bootbox, accountScreen, storage, WaitDialog, api, $, require, socket,
    messageManager, contactList, BaseTarget, appTitle, bus, notificator, focus, SettingsModal,
    embedManager
  ) {
  var appScreen = new BaseScreen('.app', 'app');

  // Helper functions

  function initUser(user) {
    app.user = appScreen.user = user;
    bus.userStorage = storage.prefix('user-' + app.user.id);
  }

  function updateTitle() {
    var sum = 0;

    $.each(appScreen.contactList.all(), function(i, c) {
      sum += c.unreadMessages();
    });

    appTitle.data.unread = sum;
  }

  function closeTarget() {
    var target = appScreen.target();

    if (target !== null) {
      var e = $('.messages > .panel-body');

      target.scroll = {
        top: e.scrollTop(),
        left: e.scrollLeft()
      };

      appScreen.target(null);
    }
  }

  function openTarget(target) {
    closeTarget();

    appScreen.target(target);

    if (target.scroll !== null) {
      var e = $('.messages > .panel-body');
      e.scrollTop(target.scroll.top).scrollLeft(target.scroll.left);
    }
  }

  function isTargetActive(target) {
    return appScreen.target() === target;
  }

  function syncContactList() {
    contactList.sync(app.user.friendlist, app.user.grouplist);

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
    var set = function(val) {
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
    n.requestPermission(function(permission) {
      wait.close();

      if (!('permission' in n))
        n.permission = permission;

      if (permission === 'granted')
        set(true);
    });
  }

  function toggleMute() {
    var muted = appScreen.panel.isMuted;

    muted(!muted());

    bus.userStorage.set('sound-muted', muted());
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

          api.logout(function () {
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

    api.searchAccounts(query, function(results) {
      wait.close();

      appScreen.friendSearch.results(results);
    });
  }

  function contactsCreateGroup() {
    var wait = new WaitDialog('creating group');

    api.createGroup(function(result) {
      wait.close();

      var g = {
        id: result.groupId,
        role: 'admin',
        members: []
      };

      app.user.grouplist.push(g);

      syncContactList();

      var group = contactList.findGroup(g.id);
      openTarget(group);

      messageManager.systemMessage(group, 'group created');
    });
  }

  function contactListEnum() {
    var contacts = appScreen.contactList.contacts();
    var groups = appScreen.contactList.groups();

    var alphaSort = function(a, b) {
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
    api.friendRequest(user.id, function(result) {
      wait.close();

      bootbox.alert(result === 'OK' ? 'friend request sent' : 'something went wrong');

      if (result === 'OK') {
        appScreen.friendSearch.results.remove(user);

        var f = {
          id: user.id,
          nick: user.nick,
          state: null,
          invokerId: app.user.id
        };

        app.user.friendlist.push(f);
        syncContactList();
      }
    });
  }

  function sendFriendResponse(targetId, decision) {
    var wait = new WaitDialog('sending response');

    api.friendResponse(targetId, decision, function(result) {
      wait.close();

      if (result === 'OK')
        setFriendState(targetId, decision);
      else
        bootbox.alert('something went wrong');
    });
  }

  function friendResponseYes() {
    sendFriendResponse(appScreen.target().id, 'accepted');
  }

  function friendResponseNo() {
    sendFriendResponse(appScreen.target().id, 'denied');
  }

  function friendResponseNever() {
    bootbox.confirm('do you really want to ignore this user?', function(result) {
      if (!result)
        return;

      sendFriendResponse(appScreen.target().id, 'accepted');
    });
  }

  function setFriendState(id, state) {
    var fun;
    if (state === 'accepted') {
      fun = function(f) {
        if (f.id === id)
          f.state = state;

        return true;
      };
    }
    else {
      fun = function(f) {
        return f.id !== id;
      };
    }

    app.user.friendlist = $.grep(app.user.friendlist, fun);
    syncContactList();

    var contact = contactList.findContact(id);
    if (contact === null || contact.invokerId === id)
      return;

    messageManager.systemMessage(contact.displayName() + ' added you to his/hers contact list');
  }

  function setFriendOnline(id, online) {
    $.each(app.user.friendlist, function(i, f) {
      if (f.id === id)
        f.isOnline = online;
    });

    // do not use syncContactList() because it's overkill
    $.each(appScreen.contactList.contacts(), function(i, f) {
      if (f.id === id)
        f.isOnline(online);
    });
  }

  function groupLeave() {
    var cb = function(notAgain) {
      var wait = new WaitDialog('leaving group');
      var group = appScreen.target();

      api.leaveGroup(group.id, notAgain, function(result) {
        wait.close();

        if (result !== 'OK') {
          bootbox.alert('something went wrong');
          return;
        }

        var fun;
        if (notAgain) {
          fun = function(g) {
            if (g.id === group.id)
              g.doNotInviteAgain = true;

            return true;
          };
        }
        else {
          fun = function(g) {
            return g.id !== group.id;
          };
        }

        app.user.grouplist = $.grep(app.user.grouplist, fun);
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
          callback: function() {
            cb(false);
          }
        },
        dnia: {
          label: 'do not invite me again',
          className: 'btn-danger',
          callback: function() {
            cb(true);
          }
        }
      }
    });
  }

  // TODO: test and optimize
  function processMessageScroll() {
    var target = appScreen.target();

    if (target === null)
      return;

    var el = $('.messages > .panel-body');
    var bottom = el.height();
    var skip = target.lastReadMessage();

    //console.log('bottom:', bottom, 'skip:', skip);

    $(target.messages).children().slice(skip).each(function(i) {
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

  var isAutoScrollDisabledByScrolling = false;

  function updateAutoScroll() {
    var el = $('.messages > .panel-body');
    
    if(el.length === 0)
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
    var el = $('.messages > .panel-body');
    el.scrollTop(el.prop('scrollHeight') - el.outerHeight());
  }

  function bindMessagesEvents() {
    $('.messages > .panel-body')
      .off('scroll', messagesScrollHandler)
      .on('scroll', messagesScrollHandler);

    $('.messages .composer textarea')
      .off('focus', processMessageScroll)
      .on('focus', processMessageScroll);
      
    $('.messages > .panel-body').tooltip({
      selector: '[data-imagepreview],[data-tooltiptext]',
      html: true,
      title: function() {
        var el = $(this);
        var html = '';
        
        if(el.is('[data-imagepreview]')) {
          var url = el.attr('data-imagepreview');
          var ext = url.split('.').pop();

          if(ext === 'webm' || ext === 'gifv') {
            html += '<div class="imagepreview"><video autoplay loop src="' + url + '" alt="video preview"></video></div>';
          } else
            html += '<div class="imagepreview"><img src="' + url + '" alt="image preview"></div>';
        }
        
        if(el.is('[data-tooltiptext]'))
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

    var el = $('.messages > .panel-body');
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

  // Model definition

  appScreen.target = ko.observable(null);
  appScreen.closeTarget = closeTarget;
  appScreen.openTarget = openTarget;
  appScreen.isTargetActive = isTargetActive;

  appScreen.panel = {
    toggleNotifications: toggleNotifications,
    toggleMute: toggleMute,

    areNotificationsAllowed: ko.observable(false),
    isMuted: ko.observable(false),

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
    sendYes: friendResponseYes,
    sendNo: friendResponseNo,
    sendNever: friendResponseNever
  };

  appScreen.groupMenu = {
    leave: groupLeave
  };

  appScreen.contactMenu = {

  };

  appScreen.isStorageAvailable = storage.isAvailable;

  // Bus bindings

  bus.subscribe('apptitle.update', function() {
    updateTitle();
  });

  bus.subscribe('app.focus', function(focus) {
    if (focus)
      processMessageScroll();
  });

  bus.subscribe('messages.processUnread', function(target) {
    processUnread(target);
  });
  
  bus.subscribe('messages.updateAutoScroll', function() {
    updateAutoScroll();
  });

  // Event bindings

  $(document).on('click', 'a.embed', function() {
    var embed = embedManager.format(this);
    
    if(embed === null)
      return;

    appScreen.embed.title(embed.title);
    appScreen.embed.html(embed.html);
    return false;
  });

  var ignoreNextUnload = false;
  $(document).on('click', 'a.ignore-unload', function() {
    ignoreNextUnload = true;
  });

  $(window).on('beforeunload', function() {
    if (ignoreNextUnload) {
      ignoreNextUnload = false;
      return;
    }

    if (app.user !== undefined)
      return 'Do you really want to exit?';
  });

  appScreen.target.subscribe(function(value) {
    setTimeout(function() {
      bindMessagesEvents();

      if (value !== null) {
        scrollMessagesHideRead();

        processMessageScroll();
      }
    }, 10);
  });

  appScreen.contactList.all.subscribe(function() {
    updateTitle();
  });

  appScreen.onInit = function() {
    initUser(app.user);
    
    SettingsModal.setDefaults();

    appScreen.panel.isMuted(bus.userStorage.get('sound-muted') ? true : false);
    if ('Notification' in window && bus.userStorage.get('notifications') && Notification.permission === "granted")
      toggleNotifications();

    syncContactList();
  };

  appScreen.onReset = function() {
    contactList.sync([], []); // clear contact list

    appScreen.target(null);

    appScreen.panel.areNotificationsAllowed(false);
    appScreen.panel.isMuted(false);

    appScreen.friendSearch.visible(false);
    resetFriendSearch();

    appScreen.embed.title(null);
    appScreen.embed.html(null);

    appScreen.user = undefined;
  };

  // API bindings

  api.on('chat message', function(msg) {
    messageManager.processMessage(msg);

    updateTitle();
  });

  api.on('friend offline', function(data) {
    if (typeof data !== 'object')
      return;

    setFriendOnline(data.friendId, false);
  });

  api.on('friend online', function(data) {
    if (typeof data !== 'object')
      return;

    setFriendOnline(data.friendId, true);
  });

  api.on('friend request', function(data) {
    if (typeof data !== 'object')
      return;

    var f = {
      id: data.invoker.id,
      nick: data.invoker.nick,
      invokerId: data.invoker.id,
      isOnline: false,
      state: 'waiting'
    };

    app.user.friendlist.push(f);
    syncContactList();

    var contact = contactList.findContact(f.id);
    messageManager.systemMessage(contact, contact.displayName() + ' wants to be in your contact list');
  });

  api.on('friend response', function(data) {
    if (typeof data !== 'object')
      return;

    setFriendState(data.targetId, data.decision);
  });

  api.on('group member leave', function(data) {
    if (typeof data !== 'object')
      return;

    $.each(app.user.grouplist, function(i, g) {
      if (g.id !== data.groupId)
        return;

      g.members = $.grep(g.members, function(m) {
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

  api.on('group remove', function(data) {
    if (typeof data !== 'object')
      return;

    app.user.grouplist = $.grep(app.user.grouplist, function(g) {
      return g.id !== data.groupId;
    });

    syncContactList();
  });

  api.on('group invitation', function(data) {
    if (typeof data !== 'object')
      return;

    var afterSync;

    if (!data.user) { // current user is invited to group
      app.user.grouplist.push(data.group);

      afterSync = function() {
        contactList.query([{
          type: 'group',
          id: data.group.id
        }, {
          type: 'contact',
          id: data.inviterId
        }], function(group, inviter) {
          messageManager.systemMessage(group, inviter.displayName() + ' invited you to this group');
        });
      };
    }
    else { // someone invited someone in group where current user already is
      $.each(app.user.grouplist, function(i, g) {
        if (g.id !== data.groupId)
          return;

        g.members.push(data.user);
      });

      afterSync = function() {
        contactList.query([{
          type: 'group',
          id: data.groupId
        }, {
          type: 'contact',
          id: data.inviterId
        }, {
          type: 'contact',
          id: data.user.id
        }], function(group, inviter, user) {
          messageManager.systemMessage(group, inviter.displayName() + ' invited ' + user.displayName() + ' to this group')
        });
      };
    }

    syncContactList();
    afterSync();
  });

  // Socket event bindings

  var io = socket();

  io.on('reconnect', function() {
    if (app.user === undefined) // user not logged in
      return;

    var wait = new WaitDialog('restoring login');
    api.restoreLogin(app.user.loginToken, function(result) {
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