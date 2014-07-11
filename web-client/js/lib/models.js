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
  var ComposerModel = function() {
    this.text = ko.observable('');

    this.submit = ComposerModel.send;
  };

  ComposerModel.cmdMsg = function(msg, target) {
    var cmd = msg.text.substr(1);
    var arg = null;
    
    var split = cmd.indexOf(' ');
    if(split > 0) {
      arg = cmd.substr(split + 1);
      cmd = cmd.substr(0, split);
    }
    
    var pushMsg = function(text) {
      app.utils.systemMessage(target, text);
    };
    
    var findFriend = function(text) {
      var fl = app.appModelView.app.account.friendlist();
      for(var k in fl) {
        var f = fl[k];
        
        if(f.displayName() !== text && f.nick() !== text)
          continue;
        
        if(!f.isVisible())
          continue;
        
        return f;
      }
      
      return null;
    };
    
    if(cmd === 'invite') {
      if(!(target instanceof app.models.GroupModel))
        return pushMsg(cmd + ': allowed only in group');
      
      if(arg === null)
        return pushMsg(cmd + ': please specify friend\'s nick or visible name');
      
      var f = findFriend(arg);
      
      if(f === null)
        return pushMsg(cmd + ': friend \'' + arg + '\' not found');
      
      target.invite(f.id());
      pushMsg(cmd + ': ' + f.displayName() + ' invited');
    } else if(cmd === 'members') {
      if(!(target instanceof app.models.GroupModel))
        return pushMsg(cmd + ': allowed only in group');
      
      var members = target.members();
      var names = [];
      for(var i in members)
        names.push(members[i].displayName());
      
      names.push(app.appModelView.app.account.nick());
      names.sort();
      
      pushMsg(cmd + ': ' + names.join(', '));
    } else
      pushMsg(cmd + ': unrecognized command');
  };

  ComposerModel.send = function() {
    var target = app.appModelView.app.target();
    if(target === null)
      return;

    var text = target.composer.text();
    if(text.trim().length === 0)
      return;

    target.composer.text('');

    var msg = {
      text: text
    };

    if(target instanceof app.models.FriendModel)
      msg.recipientId = target.id();
    else if(target instanceof app.models.GroupModel)
      msg.groupId = target.id();
    else
      throw new Error('Target not supported');

    if(msg.text.indexOf('/') === 0) {
      ComposerModel.cmdMsg(msg, target);
      return;
    }

    app.api.chatMessage(msg);
  };
  
  app.models.ComposerModel = ComposerModel;
})(document.syntaxApp);



(function(app) {
  var newLineRegEx = /(?:\r\n|\r|\n)/g;
  
  var format = function(msg) {
    var html = $('<div>').text(msg.text()).html();
    html = html.replace(newLineRegEx, '<br>');
    html = app.utils.emoticons.replace(html);
    html = app.utils.links.replace(html);
    
    return html;
  };
  
  var MessageModel = function(init, sender, target) {
    this.text = ko.observable(init.text);

    this._sender = sender;
    this._target = target;
    this._time = moment.unix(init.time);
    this.type = 'chat';

    if(this._sender && this._target) {
      if(this._sender === 'self')
        this.sender = app.appModelView.app.account.nick();
      else {
        if(this._sender.type === 'friend')
          this.sender = this._sender.displayName();
        else {
          var members = this._sender.members();
          for(var k in members) {
            var m = members[k];

            if(m.id() !== init.senderId)
              continue;

            this.sender = m.displayName();
            break;
          }
        }
      }
    }

    this.formattedTime = this._time.format('HH:mm');
    this.formattedText = format(this);
  };
  
  app.models.MessageModel = MessageModel;
})(document.syntaxApp);


(function(app) {
  var GroupMemberModel = function() {
    this.id = ko.observable(0);
    this.nick = ko.observable('');
    
    var m = this;
    this.displayName = ko.computed(function() {
      return m.nick();
    });
  };
  
  app.models.GroupMemberModel = GroupMemberModel;
})(document.syntaxApp);


(function(app) {
  var GroupModel = function() {
    var mv = app.appModelView;
    
    this.type = 'group';

    this.id = ko.observable(0);
    this.alias = ko.observable('');
    this.isBanned = ko.observable(false);
    this.doNotInviteAgain = ko.observable(false);
    this.role = ko.observable('');
    this.members = ko.observableArray();
    this.messages = ko.observableArray();
    this.isFavorite = ko.observable(false);
    this.topic = ko.observable('');
    this.unreadMessages = ko.observable(0);
    this.scrollTop = 0;

    var m = this;
    this.displayName = ko.computed(function() {
      return !m.alias() ? 'group' : m.alias();
    });

    this.rename = function() {
      bootbox.prompt('enter new name', function(result) {
        if(result === null)
          return;

        window.localStorage['alias-group-' + m.id()] = result;
        m.alias(result);
      });
    };

    this.isVisible = ko.computed(function() {
      return !m.isBanned() && !m.doNotInviteAgain();
    });

    this.isActive = ko.computed(function() {
      return mv.app.target() === m;
    });

    this.setActive = function() {
      mv.app.clearTarget();

      mv.app.target(m);
      $('.messages .panel-body').scrollTop(m.scrollTop);
      m.unreadMessages(0);
    };

    this.invite = function(friendId) {
      var wait = app.utils.waitDialog('sending invitation');
      
      app.api.groupInvite(m.id(), friendId, function(result) {
        wait.modal('hide');
        
        if(result !== 'OK')
          bootbox.alert('something went wrong');
      });
    };

    this.leave = function() {
      var cb = function(notAgain) {
        var wait = app.utils.waitDialog('leaving group');
        var group = mv.app.target();

        app.api.leaveGroup(group.id(), notAgain, function(result) {
          wait.modal('hide');

          if(result !== 'OK') {
            bootbox.alert('something went wrong');
            return;
          }

          mv.app.target(null);
          if(notAgain)
            group.doNotInviteAgain(true);
          else
            mv.app.account.grouplist.remove(group);
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
            callback: function() { cb(false); }
          },
          dnia: {
            label: 'do not invite me again',
            className: 'btn-danger',
            callback: function() { cb(true); }
          }
        }
      });
    };

    this.composer = new app.models.ComposerModel();
  };
  
  app.models.GroupModel = GroupModel;
})(document.syntaxApp);



(function(app) {
  var FriendModel = function() {
    var mv = app.appModelView;
    
    this.type = 'friend';

    this.id = ko.observable(0);
    this.nick = ko.observable('');
    this.isOnline = ko.observable(false);
    this.state = ko.observable(null);
    this.messages = ko.observableArray();
    this.invokerId = ko.observable(0);
    this.isFavorite = ko.observable(false);
    this.unreadMessages = ko.observable(0);
    this.scrollTop = 0;
    this.alias = ko.observable('');

    var m = this;
    this.displayName = ko.computed(function() {
      return !m.alias() ? m.nick() : m.alias();
    });

    this.rename = function() {
      bootbox.prompt('enter new name (leave empty for original name)', function(result) {
        if(result === null)
          return;

        window.localStorage['alias-friend-' + m.id()] = result;
        m.alias(result);
      });
    };

    this.isActive = ko.computed(function() {
      return mv.app.target() === m;
    });

    this.setActive = function() {
      mv.app.clearTarget();
      
      mv.app.target(m);
      $('.messages .panel-body').scrollTop(m.scrollTop);
      m.unreadMessages(0);
    };

    this.isAccepted = ko.computed(function() {
      return m.state() === 'accepted';
    });

    this.isVisible = ko.computed(function() {
      return m.state() === null || m.isAccepted();
    });

    this.isCurrentUserInvoker = ko.computed(function() {
      return m.invokerId() === mv.app.account.id();
    });

    this.hasBeenResponded = ko.computed(function() {
      return m.state() !== null;
    });

    this.gotResponse = function(decision) {
      m.state(decision);

      if(decision !== 'accepted') {
        if(mv.app.target() === m)
          mv.app.target(null);
      }

      if(decision === 'denied')
        mv.app.account.friendlist.remove(m);
    };

    this.respond = function(decision) {
      var wait = app.utils.waitDialog('sending response');

      app.api.friendResponse(m.id(), decision, function(result) {
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

    this.composer = new app.models.ComposerModel();
  };
  
  app.models.FriendModel = FriendModel;
})(document.syntaxApp);