/*!
 * URI.js - Mutating URLs
 * IPv6 Support
 *
 * Version: 1.13.2
 *
 * Author: Rodney Rehm
 * Web: http://medialize.github.io/URI.js/
 *
 * Licensed under
 *   MIT License http://www.opensource.org/licenses/mit-license
 *   GPL v3 http://opensource.org/licenses/GPL-3.0
 *
 */
!function(a,b){"use strict";"object"==typeof exports?module.exports=b():"function"==typeof define&&define.amd?define(b):a.IPv6=b(a)}(this,function(a){"use strict";function c(a){var b=a.toLowerCase(),c=b.split(":"),d=c.length,e=8;""===c[0]&&""===c[1]&&""===c[2]?(c.shift(),c.shift()):""===c[0]&&""===c[1]?c.shift():""===c[d-1]&&""===c[d-2]&&c.pop(),d=c.length,-1!==c[d-1].indexOf(".")&&(e=7);var f;for(f=0;d>f&&""!==c[f];f++);if(e>f){for(c.splice(f,1,"0000");c.length<e;)c.splice(f,0,"0000");d=c.length}for(var g,h=0;e>h;h++){g=c[h].split("");for(var i=0;3>i&&"0"===g[0]&&g.length>1;i++)g.splice(0,1);c[h]=g.join("")}var j=-1,k=0,l=0,m=-1,n=!1;for(h=0;e>h;h++)n?"0"===c[h]?l+=1:(n=!1,l>k&&(j=m,k=l)):"0"===c[h]&&(n=!0,m=h,l=1);l>k&&(j=m,k=l),k>1&&c.splice(j,k,""),d=c.length;var o="";for(""===c[0]&&(o=":"),h=0;d>h&&(o+=c[h],h!==d-1);h++)o+=":";return""===c[d-1]&&(o+=":"),o}function d(){return a.IPv6===this&&(a.IPv6=b),this}var b=a&&a.IPv6;return{best:c,noConflict:d}});