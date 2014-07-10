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

(function(app) {
  var AppModelView = function() {
    var api = app.api;
    var self = this;
    
    self.getFriend = function(id) {
      var fl = self.app.account.friendlist();
      
      for(var k in fl) {
        var f = fl[k];
        
        if(f.id() === id)
          return f;
      }
      
      return null;
    };
  
    self.setFriend = function(id) {
      var f = self.getFriend(id);
      
      if(f !== null)
        return f;
      
      f = new app.models.FriendModel();
      f.id(id);
      
      if('localStorage' in window)
        f.alias(window.localStorage['alias-friend-' + f.id()]);
      
      self.app.account.friendlist.push(f);
      return f;
    };
    
    self.getGroup = function(id) {
      var gl = self.app.account.grouplist();
      
      for(var k in gl) {
        var g = gl[k];
        
        if(g.id() === id)
          return g;
      }
      
      return null;
    };
    
    self.setGroup = function(id) {
      var g = self.getGroup(id);
      
      if(g !== null)
        return g;
      
      g = new app.models.GroupModel();
      g.id(id);
      
      if('localStorage' in window)
        g.alias(window.localStorage['alias-group-' + g.id()]);
      
      self.app.account.grouplist.push(g);
      return g;
    };
    
    self.createAccount = { email: ko.observable(''), nick: ko.observable(''), password: ko.observable(''), passwordAgain: ko.observable(''), submit: function() {
        var email = self.createAccount.email();
        var nick = self.createAccount.nick();
        var password = self.createAccount.password();
        var passwordAgain = self.createAccount.passwordAgain();
        
        if(nick < 4) {
          bootbox.alert('nick is too short');
          return;
        }
        
        if(password.length < 5) {
          bootbox.alert('password is too short');
          return;
        }
        
        if(password !== passwordAgain) {
          bootbox.alert('passwords do not match');
          return;
        }
        
        var wait = bootbox.dialog({
          message: 'please wait',
          title: 'creating account',
          closeButton: false
        });
        
        api.createAccount(email, nick, password, function(result) {
          wait.modal('hide');
          
          var message;
          switch(result) {
            case 'OK':
              message = 'your account has been created, please check your inbox and click on activation link';
              break;
            case 'ERR_INVALID_VALUES':
              message = 'invalid values were entered';
              break;
            case 'ERR_ALREADY_USED':
              message = 'given email address is already used';
              break;
            default:
              message = 'an error occured, please contact support';
              break;
          }
          
          bootbox.alert(message);
        });
    }};
  
    self.initGroup = function(row) {
      var g = self.setGroup(row.id);
      g.doNotInviteAgain(row.doNotInviteAgain);
      g.isBanned(row.isBanned);
      g.isFavorite(row.isFavorite);
      g.role(row.role);
      g.topic(row.topic);

      for(var l in row.members) {
        var m = row.members[l];
        var f = self.getFriend(m.id);

        if(f === null) {
          f = new app.models.GroupMemberModel();
          f.id(m.id);
          f.nick(m.nick);
        }

        g.members.push(f);
      }
      
      return g;
    };
  
    var loginValid = function(result) {
      if(self.login.stayOnline())
        $.cookie('loginToken', result.loginToken, { expires: 365 });
      
      self.login.lastLoginToken = result.loginToken;
      
      var acc = self.app.account;
      for(var k in result) {
        if(k === 'friendlist' || k === 'grouplist')
          continue;
        
        if(k in acc)
          acc[k](result[k]);
      }
      
      acc.friendlist.removeAll();
      for(var k in result.friendlist) {
        var row = result.friendlist[k];
        
        var f = self.setFriend(row.id);
        f.nick(row.nick);
        f.state(row.state);
        f.isOnline(row.isOnline);
        f.invokerId(row.invokerId);
        f.isFavorite(row.isFavorite);
      }
      
      acc.grouplist.removeAll();
      for(var k in result.grouplist) {
        var row = result.grouplist[k];
        
        self.initGroup(row);
      }
      
      $('div.account').fadeOut(200);
    };
  
    self.login = { email: ko.observable(''), password: ko.observable(''), stayOnline: ko.observable(true), lastLoginToken: '', submit: function() {
        var wait = bootbox.dialog({
          message: 'please wait',
          title: 'logging in',
          closeButton: false
        });
        
        $.removeCookie('loginToken');
        
        var email = self.login.email();
        var pwd = self.login.password();
        
        api.login(email, pwd, function(result) {
          wait.modal('hide');
          
          var message = null;
          switch(result) {
            case 'ERR_NOT_ACTIVATED':
              message = 'account is not activated';
              break;
            case 'ERR_NOT_FOUND':
              message = 'email or password incorrect';
              break;
            case 'ERR_INVALID_VALUES':
              message = 'invalid values were entered';
              break;
            default:
              loginValid(result);
              break;
          }
          
          if(message !== null)
            bootbox.alert(message);
        });
    }};
  
    self.app = {
      account: {
        id: ko.observable(0),
        nick: ko.observable(''),
        logout: function(force) {
          var lo = function() {
            $.removeCookie('loginToken');
            api.logout();
            $('div.account').fadeIn(200, function() {
              if($('.add-friend').is(':visible'))
                self.app.addFriend.toggle();

              self.login.lastLoginToken = '';
              self.app.account.id(0);
              self.app.account.nick('');
              self.app.account.friendlist.removeAll();

              self.app.target(null);
            });
          };
          
          if(force)
            lo();
          else {
            bootbox.confirm('do you really want to logout?', function(result) {
              if(result)
                lo();
            });
          }
        },
        friendlist: ko.observableArray(),
        grouplist: ko.observableArray()
      },
      target: ko.observable(null),
      clearTarget: function() {
        self.app.target(null);
      },
      addFriend: {
        submit: function() {
          var wait = bootbox.dialog({
            message: 'please wait',
            title: 'searching',
            closeButton: false
          });
          
          api.searchAccounts(self.app.addFriend.search(), function(results) {
            wait.modal('hide');
            
            self.app.addFriend.results.removeAll();
            for(var k in results)
              self.app.addFriend.results.push(results[k]);
          });
        },
        search: ko.observable(''),
        results: ko.observableArray([]),
        toggle: function() {
          var add = $('.add-friend');
          var contacts = $('.contacts');
          if(add.is(':visible')) {
            add.slideUp(function() {
              self.app.addFriend.search('');
              self.app.addFriend.results.removeAll();
            });
            contacts.slideDown();
          } else {
            add.hide().removeClass('hidden').slideDown(function() {
              add.find('input').focus();
            });
            contacts.slideUp();
          }
        },
        sendRequest: function(row) {
          var wait = bootbox.dialog({
            message: 'please wait',
            title: 'sending request',
            closeButton: false
          });
          
          api.friendRequest(row.id, function(result) {
            wait.modal('hide');
            
            bootbox.alert(result === 'OK' ? 'friend request sent' : 'something went wrong');
            
            if(result === 'OK') {
              self.app.addFriend.results.remove(row);
            
              var f = self.setFriend(row.id);
              f.nick(row.nick);
              f.invokerId(self.app.account.id());
              f.state(null);
            }
          });
        }
      }
    };
    
    self.app.account.contacts = ko.computed(function() {
      var ret = self.app.account.grouplist().sort(function(l, r) {
        return l.displayName() > r.displayName() ? 1 : -1;
      }).concat(self.app.account.friendlist().sort(function(l, r) {
        return l.displayName() > r.displayName() ? 1 : -1;
      }));
      
      for(var k in ret) {
        if(ret[k].isVisible())
          continue;
        
        ret.splice(k, 1);
      }
      
      return ret;
    });
    
    self.app.account.createGroup = function() {
      var wait = bootbox.dialog({
        message: 'please wait',
        title: 'creating group',
        closeButton: false
      });
      
      api.createGroup(function(result) {
        wait.modal('hide');
        
        var g = self.setGroup(result.groupId);
        g.role('admin');
        g.setActive();
        
        var msg = new app.models.MessageModel({
          text: 'group created',
          time: moment().unix()
        });
        msg.type = 'system';
        
        g.messages.push(msg);
      });
    };
    
    var onlineOffline = function(id, state) {
      var fl = self.app.account.friendlist();
      for(var k in fl) {
        if(fl[k].id() !== id)
          continue;
        
        fl[k].isOnline(state);
      }
    };
    
    api.on('friend offline', function(data) {
      if(typeof data !== 'object')
        return;
      
      onlineOffline(data.friendId, false);
    });
    
    api.on('friend online', function(data) {
      if(typeof data !== 'object')
        return;
      
      onlineOffline(data.friendId, true);
    });
    
    api.on('friend response', function(data) {
      if(typeof data !== 'object')
        return;
      
      var fl = self.app.account.friendlist();
      for(var k in fl) {
        if(fl[k].id() !== data.targetId)
          continue;
        
        fl[k].gotResponse(data.decision);
        break;
      }
    });
    
    api.on('friend request', function(data) {
      if(typeof data !== 'object')
        return;
      
      var f = self.setFriend(data.invoker.id);
      f.nick(data.invoker.nick);
      f.invokerId(data.invoker.id);
    });
    
    
    var isMessageDivScrolledToBottom = function() {
      var messagesPanel = $('.messages .panel-body');
      return messagesPanel.scrollTop() === messagesPanel.prop('scrollHeight') - messagesPanel.outerHeight();
    };
    
    var scrollMessageDivToBottom = function() {
      var messagesPanel = $('.messages .panel-body');
      messagesPanel.scrollTop(messagesPanel.prop('scrollHeight') - messagesPanel.outerHeight());
    };
    
    api.on('chat message', function(data) {
      var target = null;
      var sender = null;
      
      if(data.recipientId) {
        var friend = null;
        var friendlist = self.app.account.friendlist();
        for(var k in friendlist) {
          var f = friendlist[k];
          
          if(f.id() !== data.recipientId && f.id() !== data.senderId)
            continue;
          
          if(f.state() !== 'accepted')
            return;

          friend = f;
          break;
        }
        
        if(data.recipientId === self.app.account.id()) {
          target = 'self';
          sender = friend;
        } else {
          sender = 'self';
          target = friend;
        }
      } else if(data.groupId) {
        var group = null;
        var grouplist = self.app.account.grouplist();
        for(var k in grouplist) {
          var g = grouplist[k];
          
          if(g.id() !== data.groupId)
            continue;
          
          if(!g.isVisible())
            return;
          
          group = g;
          break;
        }
        
        if(data.senderId === self.app.account.id()) {
          sender = 'self';
          target = group;
        } else {
          sender = group;
          target = 'self';
        }
      }
      
      if(target === null || sender === null)
        return;
      
      var msg = new app.models.MessageModel(data, sender, target);
      
      if(target === 'self')
        target = sender;
      
      if(target.isActive() && $('.composer input[type=text]').is(':focus') && isMessageDivScrolledToBottom()) {
        target.messages.push(msg);
        scrollMessageDivToBottom();
      } else
        target.messages.push(msg);
      
      if(sender !== 'self' && (!app.isFocused || !target.isActive()))
        app.sfxs['o-ou'].play();
      
      if(!app.isFocused)
        app.title.unread++;
      
      if(!target.isActive())
        target.unreadMessages(target.unreadMessages() + 1);
    });
    
    api.on('group remove', function(data) {
      var group = self.getGroup(data.groupId);
      
      self.app.account.grouplist.remove(group);
    });
    
    api.on('group member leave', function(data) {
      var group = self.getGroup(data.groupId);
      
      if(group === null)
        return;
      
      var members = group.members();
      for(var k in members) {
        var m = members[k];
        
        if(m.id() !== data.memberId)
          continue;
        
        app.utils.systemMessage(group, 'user ' + m.displayName() + ' left this group');
        
        group.members.remove(m);
        break;
      }
    });
    
    api.on('group invitation', function(data) {
      if(!data.user) {
        var g = self.initGroup(data.group);
        var f = self.getFriend(data.inviterId);
        app.utils.systemMessage(g, f.displayName() + ' invited you to this group');
      } else {
        var g = self.getGroup(data.groupId);

        var u = self.getFriend(data.user.id);
        if(u === null) {
          u = new app.models.GroupMemberModel();
          u.id(data.user.id);
          u.nick(data.user.nick);
        }
        
        g.members.push(u);
        
        var inviter;
        if(data.inviterId !== self.app.account.id())
          inviter = self.getFriend(data.inviterId).displayName();
        else
          inviter = 'you';
        
        app.utils.systemMessage(g, inviter + ' invited ' + u.displayName());
      }
    });
    
    var loginToken = $.cookie('loginToken');
    if(loginToken !== undefined) {
      var wait = app.utils.waitDialog('logging in');
      
      api.restoreLogin(loginToken, function(result) {
        wait.modal('hide');
        
        $.removeCookie('loginToken');
        
        if(result === 'ERR_INVALID')
          bootbox.alert('could not restore your login');
        else
          loginValid(result);
      });
    }
    
    var reconnectingDialog = null;
    app.io.on('reconnecting', function() {
      if(reconnectingDialog !== null)
        return;
      
      reconnectingDialog = app.utils.waitDialog('connection lost, reconnecting');
    });
    
    app.io.on('reconnect', function() {
      reconnectingDialog.modal('hide');
      reconnectingDialog = null;
      
      if(!self.app.account.id())
        return;
      
      var wait = app.utils.waitDialog('relogging in');
      var targetIndex = self.app.account.contacts().indexOf(self.app.target());
      
      api.restoreLogin(self.login.lastLoginToken, function(result) {
        wait.modal('hide');
        $.removeCookie('loginToken');
        if(result === 'ERR_INVALID') {
          self.app.account.logout(true);
          bootbox.alert('could not restore your login');
        } else {
          loginValid(result);
          
          if(targetIndex >= 0) {
            var contacts = self.app.account.contacts();
            if(contacts.length > targetIndex)
              self.app.target(contacts[targetIndex]);
          }
        }
      });
    });
  };
  
  app.modelViews.AppModelView = AppModelView;
})(document.syntaxApp);