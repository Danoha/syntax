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
  var templateBegin = '$1<span class="emoticon emoticon-';
  var templateEnd = '" title="$2"></span>';
  
  var all = ['angel', 'angry', 'aww', 'blushing', 'confused', 'cool', 'creepy', 'crying', 'cthulhu', 'cute', 'cute_winking', 'devil', 'frowning', 'gasping', 'greedy', 'grinning', 'happy', 'happy_smiling', 'heart', 'irritated', 'irritated_2', 'kissing', 'laughing', 'lips_sealed', 'madness', 'malicious', 'naww', 'pouting', 'shy', 'sick', 'smiling', 'speechless', 'spiteful', 'stupid', 'surprised', 'surprised_2', 'terrified', 'thumbs_down', 'thumbs_up', 'tired', 'tongue_out', 'tongue_out_laughing', 'tongue_out_left', 'tongue_out_up', 'tongue_out_up_left', 'unsure', 'unsure_2', 'winking', 'winking_grinning', 'winking_tongue_out'];
  
  var mapping = {
    'cool': ['B)', '8)', 'B-)', '8-)'],
    'frowning': [':(', ':-('],
    'heart': ['&lt;3'],
    'kissing': [':*', ':-*'],
    'grinning': [':D', ':-D'],
    'lips_sealed': [':X', ':-X'],
    'naww': [':3', ':-3'],
    'pouting': [':C', ':-C'],
    'smiling': [':)', ':-)'],
    'speechless': [':|', ':-|'],
    'surprised': ['o.o', 'o_o'],
    'unsure': [':/', ':-/'],
    'thumbs_up': ['(y)'],
    'thumbs_down': ['(n)'],
    'tongue_out': [':P', ':-P'],
    'tongue_out_laughing': ['xP'],
    'winking': [';)', ';-)'],
    'winking_grinning': [';D', ';-D'],
    'winking_tongue_out': [';P', ';-P'],
    'tired': ['-_-', '-.-'],
    'happy': ['^^', '^_^'],
    'laughing': ['xD'],
    'malicious': ['&gt;:D'],
    'cthulhu': [':~'],
    'cute_winking': [';3'],
    'gasping': [':O', ':-O'],
    'crying': [';(', ';-(', ':\'(']
  };
  
  var quote = function(str) {
    return (str + '').replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
  };

  var Emoticons = function() {
    this.emoticons = { };

    var re = function(value) {
      return new RegExp('(\\s|^)(' + quote(value) + ')(?=(\\s|$))', 'gim'); // gim - global, case-insensitive, multiline
    };

    for(var k in mapping) {
      var regexps = [];
      var list = mapping[k];
      
      for(var i in list)
        regexps.push(re(list[i]));
      
      this.emoticons[k] = regexps;
    }
    
    for(var i in all) {
      var name = all[i];
      var list = this.emoticons[name] || [];
      
      list.push(re('(' + name + ')'));
      
      this.emoticons[name] = list;
    }
  };
  
  Emoticons.prototype.replace = function(text) {
    for(var k in this.emoticons) {
      var regexps = this.emoticons[k];
      var span = templateBegin + k + templateEnd;
      for(var i in regexps)
        text = text.replace(regexps[i], span);
    }
    
    return text;
  };
  
  app.utils.emoticons = new Emoticons();
})(document.syntaxApp);
