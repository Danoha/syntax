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

(function() {
  var Api = function(io) {
    this.io = io;
  };
  
  Api.prototype.on = function(eventName, listener) {
    this.io.on(eventName, function() {
      try {
        listener.apply(this, arguments);
      } catch(err) {
        console.error('api error', err);
      }
    });
  };

  Api.prototype.chatMessage = function(data) {
    this.io.emit('chat message', data);
  };

  Api.prototype.logout = function(callback) {
    var self = this;
    self.io.on('logout', function(result) {
      self.io.removeAllListeners('logout');
      
      callback(result);
    });
    
    self.io.emit('logout');
  };
  
  Api.prototype.login = function(email, password, callback) {
    var self = this;
    self.io.on('login', function(result) {
      self.io.removeAllListeners('login');
      
      callback(result);
    });
    
    self.io.emit('login', {
      email: email,
      hash: CryptoJS.SHA256(password).toString()
    });
  };
  
  Api.prototype.activateAccount = function(code, callback) {
    var self = this;
    self.io.on('activate account', function(result) {
      self.io.removeAllListeners('activate account');
      
      callback(result);
    });
    
    self.io.emit('activate account', {
      code: code
    });
  };
  
  Api.prototype.createAccount = function(email, nick, password, callback) {
    var self = this;
    self.io.on('create account', function(result) {
      self.io.removeAllListeners('create account');
      
      callback(result);
    });
    
    self.io.emit('create account', {
      email: email,
      nick: nick,
      hash: CryptoJS.SHA256(password).toString()
    });
  };
  
  Api.prototype.restoreLogin = function(loginToken, callback) {
    var self = this;
    self.io.on('restore login', function(result) {
      self.io.removeAllListeners('restore login');
      
      callback(result);
    });
    
    self.io.emit('restore login', {
      loginToken: loginToken
    });
  };
  
  Api.prototype.searchAccounts = function(search, callback) {
    var self = this;
    self.io.on('search accounts', function(result) {
      self.io.removeAllListeners('search accounts');
      
      callback(result);
    });
    
    self.io.emit('search accounts', {
      search: search
    });
  };
  
  Api.prototype.friendRequest = function(targetId, callback) {
    var self = this;
    self.io.on('friend request', function(result) {
      self.io.removeAllListeners('friend request');
      
      callback(result);
    });
    
    self.io.emit('friend request', {
      targetId: targetId
    });
  };
  
  Api.prototype.friendResponse = function(invokerId, decision, callback) {
    var self = this;
    self.io.on('friend response', function(result) {
      self.io.removeAllListeners('friend response');
      
      callback(result);
    });
    
    self.io.emit('friend response', {
      invokerId: invokerId,
      decision: decision
    });
  };
  
  ////
  
  var AppModelView = function(api, app) {
    var self = this;
    
    var MessageModel = function(init, sender, target) {
      this.text = ko.observable(init.text);
      
      this._sender = sender;
      this._target = target;
      this._time = moment.unix(init.time);
      
      if(this._sender === 'self')
        this.sender = self.app.account.nick();
      else
        this.sender = this._sender.nick();
      
      var m = this;
      this.formattedTime = ko.computed(function() {
        return m._time.format('HH:mm');
      });
    };
    
    var ComposerModel = function() {
      this.text = ko.observable('');
      
      this.submit = ComposerModel.send;
    };
    
    ComposerModel.send = function() {
      var target = self.app.target();
      if(target === null)
        return;
      
      var text = target.composer.text();
      if(text.trim().length === 0)
        return;
      
      target.composer.text('');
      
      var msg = {
        text: text
      };
      
      if(target instanceof FriendModel)
        msg.recipientId = target.id();
      else if(target instanceof GroupModel)
        msg.groupId = target.id();
      else
        throw new Error('Target not supported');
      
      api.chatMessage(msg);
    };
    
    var FriendModel = function() {
      this.id = ko.observable(0);
      this.nick = ko.observable('');
      this.isOnline = ko.observable(false);
      this.state = ko.observable(null);
      this.messages = ko.observableArray();
      this.invokerId = ko.observable(0);
      this.unreadMessages = ko.observable(0);
      
      var m = this;
      this.displayName = ko.computed(function() {
        return m.nick();
      });
      
      this.isActive = ko.computed(function() {
        return self.app.target() === m;
      });
      
      this.setActive = function() {
        self.app.target(m);
        m.unreadMessages(0);
      };
      
      this.isAccepted = ko.computed(function() {
        return m.state() === 'accepted';
      });
      
      this.isVisible = ko.computed(function() {
        return m.state() === null || m.isAccepted();
      });
      
      this.isCurrentUserInvoker = ko.computed(function() {
        return m.invokerId() === self.app.account.id();
      });
      
      this.hasBeenResponded = ko.computed(function() {
        return m.state() !== null;
      });
      
      this.gotResponse = function(decision) {
        m.state(decision);
            
        if(decision !== 'accepted') {
          if(self.app.target() === m)
            self.app.target(null);
        }
        
        if(decision === 'denied')
          self.app.account.friendlist.remove(m);
      };
      
      this.respond = function(decision) {
        var wait = bootbox.dialog({
          message: 'please wait',
          title: 'sending response',
          closeButton: false
        });
        
        api.friendResponse(m.id(), decision, function(result) {
          wait.modal('hide');
          
          if(result === 'OK') {
            m.gotResponse(decision);
          } else
            bootbox.alert('something went wrong');
        });
      };
      
      this.respondAccept = function() {
        m.respond('accepted');
      };
      
      this.respondDeny = function() {
        m.respond('denied');
      };
      
      this.respondIgnore = function() {
        bootbox.confirm('do you really want to ignore this user?', function(result) {
          if(!result)
            return;
          
          m.respond('ignored');
        });
      };
      
      this.composer = new ComposerModel();
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
  
    var setFriend = function(id) {
      var fl = self.app.account.friendlist();
      
      for(var k in fl) {
        var f = fl[k];
        
        if(f.id() === id)
          return f;
      }
      
      var f = new FriendModel();
      f.id(id);
      self.app.account.friendlist.push(f);
      return f;
    };
  
    var loginValid = function(result) {
      if(self.login.stayOnline())
        $.cookie('loginToken', result.loginToken, { expires: 365 });
      
      var acc = self.app.account;
      for(var k in result) {
        if(k === 'friendlist')
          continue;
        
        if(k in acc)
          acc[k](result[k]);
      }
      
      acc.friendlist.removeAll();
      for(var k in result.friendlist) {
        var row = result.friendlist[k];
        
        var f = setFriend(row.id);
        f.nick(row.nick);
        f.state(row.state);
        f.isOnline(row.isOnline);
        f.invokerId(row.invokerId);
      }
      
      $('div.account').fadeOut(200);
    };
  
    self.login = { email: ko.observable(''), password: ko.observable(''), stayOnline: ko.observable(true), submit: function() {
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
        logout: function() {
          bootbox.confirm('do you really want to logout?', function(result) {
            if(result) {
              $.removeCookie('loginToken');
              api.logout();
              $('div.account').fadeIn(200, function() {
                if($('.add-friend').is(':visible'))
                  self.app.addFriend.toggle();
                
                self.app.account.id(0);
                self.app.account.nick('');
                self.app.account.friendlist.removeAll();
                
                self.app.target(null);
              });
            }
          });
        },
        friendlist: ko.observableArray()
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
            
              var f = setFriend(row.id);
              f.nick(row.nick);
              f.invokerId(self.app.account.id());
              f.state(null);
            }
          });
        }
      }
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
      
      var f = setFriend(data.invoker.id);
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
      }
      
      // TODO search for group target
      
      if(target === null || sender === null)
        return;
      
      var msg = new MessageModel(data, sender, target);
      
      if(target === 'self')
        target = sender;
      
      if(target.isActive() && $('.composer input[type=text]').is(':focus') && isMessageDivScrolledToBottom()) {
        target.messages.push(msg);
        scrollMessageDivToBottom();
      } else
        target.messages.push(msg);
      
      if(!app.isFocused || !target.isActive())
        app.sfxs['o-ou'].play();
      
      if(!app.isFocused)
        app.title.unread++;
      
      if(!target.isActive())
        target.unreadMessages(target.unreadMessages() + 1);
    });
    
    var loginToken = $.cookie('loginToken');
    if(loginToken !== undefined) {
      var wait = bootbox.dialog({
        message: 'please wait',
        title: 'logging in',
        closeButton: false
      });
      
      api.restoreLogin(loginToken, function(result) {
        wait.modal('hide');
        
        $.removeCookie('loginToken');
        
        if(result === 'ERR_INVALID')
          bootbox.alert('could not restore your login');
        else
          loginValid(result);
      });
    }
  };
  
  ////
  
  var App = function() {
    this.loadScripts();
  };

  var hostname = location.hostname;
  if(!hostname)
    hostname = '127.0.0.1';

  App.prototype.title = {
    _position: -1,
    _handlers: {
      title: function() { return 'syntax.im'; },
      unread: function() {
        if(!this.unread)
          return false;
        
        return this.unread + ' unread message' + (this.unread > 1 ? 's' : ''); }
    },
    _order: ['title', 'unread'],
    
    unread: 0
  };
  
  App.prototype.nextTitle = function() {
    this.title._position = (this.title._position + 1) % this.title._order.length;
    var key = this.title._order[this.title._position];
    var value = this.title._handlers[key].call(this.title);
    
    if(!value)
      return this.nextTitle();
    
    document.title = value;
    
    var self = this;
    setTimeout(function() {
      self.nextTitle();
    }, 1000);
  };

  App.prototype.server = 'https://' + hostname + ':1560';
  App.prototype.scripts = [
    'js/jquery-1.11.1.min.js',
    'js/knockout-3.1.0.min.js',
    'js/sha256.min.js',
    'js/bootstrap.min.js',
    'js/bootbox.min.js',
    'js/URI.min.js',
    'js/moment.min.js',
    'js/jquery.cookie.js',
    'js/howler.min.js',
    App.prototype.server + '/socket.io/socket.io.js'
  ];
  
  App.prototype.loadScripts = function() {
    var progressBar = null;
    var pb = function() {
      progressBar = document.getElementById('loadingProgressBar');
    };
    
    var stack = this.scripts;
    var self = this;
    var total = stack.length;
    
    var next = function() {
      if(stack.length === 0) {
        self.initSfxs();
        self.initSocket();
        return;
      }
      
      var url = stack.shift();
    
      pb();
      if(progressBar !== null)
        progressBar.innerHTML = url;
      
      var script = document.createElement('script');
      document.head.appendChild(script);
      script.onload = function() {
        var current = stack.length;
        var percent = ((total - current) * 100) / total;
        
        pb();
        if(progressBar !== null)
          progressBar.style.width = percent + '%';
        
        next();
      };
      script.onerror = function() {
        setTimeout(function() {
          pb();
          progressBar.innerHTML = 'error, could not load ' + url;
          progressBar.style.width = '100%';
          progressBar.className = 'progress-bar progress-bar-danger';
        }, 0);
      };
      script.src = url;
    };
    
    next();
  };
  
  App.prototype.sfxs = ['o-ou'];
  App.prototype.initSfxs = function() {
    var cache = { };
    
    for(var k in this.sfxs) {
      var n = this.sfxs[k];
      
      cache[n] = new Howl({
        urls: ['sfx/' + n + '.ogg', 'sfx/' + n + '.mp3']
      });
    }
    
    this.sfxs = cache;
  };
  
  App.prototype.initSocket = function() {
    var self = this;
    this.io = io(this.server);
    $('#loadingProgressBar').text('connecting to chat server');
    this.io.on('connect', function() {
      $('#loadingProgressBar').text('done');
      self.io.removeAllListeners('connect');
      self.init();
    });
  };
  
  App.prototype.activate = function(code) {
    var wait = bootbox.dialog({
      message: 'please wait',
      title: 'activating your account',
      closeButton: false
    });
    
    this.api.activateAccount(code, function(result) {
      wait.modal('hide');
      
      var message;
      switch(result) {
        case 'OK':
          message = 'your account has been activated';
          break;
        case 'ERR_NOT_FOUND':
          message = 'error, your code is invalid';
          break;
      }
      
      bootbox.alert(message);
    });
  };
  
  App.prototype.initActivation = function() {
    var self = this;
    var query = URI.parseQuery(location.search);
    if(query && query.activate) {
      $(function() {
        self.activate(query.activate);
      });
    }
  };
  
  App.prototype.isFocused = true;
  App.prototype.init = function() {
    var self = this;
    $(window).on('focus', function() {
      self.isFocused = true;

      self.title.unread = 0;
    });
    $(window).on('blur', function() {
      self.isFocused = false;
    });
    
    this.nextTitle();
    this.api = new Api(this.io);
    this.modelView = new AppModelView(this.api, this);
    ko.applyBindings(this.modelView);
    
    $('div.loading').fadeOut(200);
    
    this.initActivation();
  };

  document.syntaxApp = new App();
})();