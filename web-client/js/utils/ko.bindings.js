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

define(['../vendor/knockout', 'jquery'], function(ko, $) {
  ko.bindingHandlers.slideVisible = {
    init: function(element, valueAccessor) {
      var value = valueAccessor();
      $(element).toggle(ko.unwrap(value));
    },
    update: function(element, valueAccessor) {
      var value = valueAccessor();
      ko.unwrap(value) ? $(element).slideDown() : $(element).slideUp();
    }
  };
  
  ko.bindingHandlers.contents = {
    update: function(element, valueAccessor) {
      var value = ko.unwrap(valueAccessor());
      $(element).empty().append(value);
    }
  };
});