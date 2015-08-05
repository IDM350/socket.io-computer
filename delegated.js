var sub = require('./redis').io();
var delegatedListeners = {};

sub.subscribe('computer:turn-given');
sub.subscribe('computer:turn-lost');
sub.subscribe('computer:turn-queued');

sub.on('message', function(channel, data) {
  data = data.toString();

  if ('computer:turn-queued' == channel) {
    // data is a socket.id and waiting time in seconds
    var split = data.split(':');
    var sockid = split[0];
    if (!delegatedListeners[sockid]) return;
    var time = parseInt(split[1]);
    delegatedListeners[sockid]('turn-queued', time*1000);
  } else {
    // data is just socket.id
    if (!delegatedListeners[data]) return;
    var ident = {'computer:turn-given': 'turn-given',
                 'computer:turn-lost': 'turn-lost'}[channel];
    if (ident) delegatedListeners[data](ident);
  }
}

module.exports = delegatedListeners;
