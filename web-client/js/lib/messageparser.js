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

define(['jquery', '../models/contactlist'], function ($, contactList) {
  var MessageParser = function () {
  };

  function escapeHtml(html) {
    var element = $('<div>');
    var ret = element.text(html).html();
    element.remove();
    return ret;
  }

  var newLine = ["\r\n", "\n"];
  var codeRegEx = /^[ ]{2}(.*)/mg;

  function replace(text, i, len, replacement) {
    return text.substring(0, i) + replacement + text.substr(i + len);
  }

  function parseCode(text) {
    var match,
      tmp = [];
    while ((match = codeRegEx.exec(text)) !== null) {
      tmp.push({
        value: match[1],
        originalValue: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }

    for (var i = 0; i < tmp.length - 1; i++) {
      var a = tmp[i + 0];
      var b = tmp[i + 1];
      var join = false,
        separator = null;
      $.each(newLine, function (j, nl) {
        if (a.end + nl.length !== b.start)
          return;

        var substr = text.substring(a.start, b.end);
        if (substr !== a.originalValue + nl + b.originalValue)
          return;

        join = true;
        separator = nl;
        return false;
      });

      if (!join)
        continue;

      var c = {
        value: a.value + separator + b.value,
        originalValue: a.originalValue + separator + b.originalValue,
        start: a.start,
        end: b.end
      };

      tmp.splice(i, 2, c);
      i--;
    }

    var en = 0;
    $.each(tmp, function (i, item) {
      text = replace(text, item.start + en, item.end - item.start, '<pre>' + item.value + '</pre>');
      en += 13 - (item.originalValue.length - item.value.length);
    });

    return text;
  }

  function parse(text) {
    text = escapeHtml(text);

    text = parseCode(text);

    return text;
  }

  MessageParser.prototype.parse = parse;
  MessageParser.prototype.escapeHtml = escapeHtml;

  return new MessageParser();
});