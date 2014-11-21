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

define(function () {
  var TitleManager = function () {
    this._nextTitle();
  };

  TitleManager.prototype._position = -1;

  TitleManager.prototype._handlers = {
    title: function () {
      return 'syntax.im';
    },
    unread: function () {
      if (!this.unread)
        return false;

      return this.unread + ' unread message' + (this.unread > 1 ? 's' : '');
    }
  };

  TitleManager.prototype._order = ['title', 'unread'];

  TitleManager.prototype.data = {
    unread: 0
  };

  TitleManager.prototype._nextTitle = function () {
    this._position = (this._position + 1) % this._order.length;
    var key = this._order[this._position];
    var value = this._handlers[key].call(this.data);

    if (!value)
      return this._nextTitle();

    document.title = value;

    var self = this;
    setTimeout(function () {
      self._nextTitle();
    }, 1000);
  };

  return new TitleManager();
});