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
  function Utils() {
  }

  Utils.prototype.waitDialog = function(text) {
    return bootbox.dialog({
      message: 'please wait',
      title: text,
      closeButton: false
    });
  };

  Utils.prototype.systemMessage = function(target, text) {
    var msg = new app.models.MessageModel({
      text: text,
      time: moment().unix()
    });
    msg.type = 'system';

    target.messages.push(msg);
  };

  app.utils = new Utils();
})(document.syntaxApp);