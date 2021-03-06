var NATS = require ('../'),
    nsc = require('./support/nats_server_control');

describe('Basics', function() {

  var PORT = 1421;
  var server;

  // Start up our own nats-server
  before(function(done) {
    server = nsc.start_server(PORT, done);
  });

  // Shutdown our server
  after(function() {
    server.kill();
  });

  it('should do basic subscribe and unsubscribe', function(done) {
    var nc = NATS.connect(PORT);
    var sid = nc.subscribe('foo');
    sid.should.exist;
    nc.unsubscribe(sid);
    nc.flush(function() {
      nc.close();
      done();
    });
  });

  it('should do basic publish', function(done) {
    var nc = NATS.connect(PORT);
    nc.publish('foo');
    nc.flush(function() {
      nc.close();
      done();
    });
  });

  it('should fire a callback for subscription', function(done) {
    var nc = NATS.connect(PORT);
    nc.subscribe('foo', function() {
      nc.close();
      done();
    });
    nc.publish('foo');
  });

  it('should include the correct message in the callback', function(done) {
    var nc = NATS.connect(PORT);
    var data = 'Hello World';
    nc.subscribe('foo', function(msg) {
      msg.should.exist;
      msg.should.equal(data);
      nc.close();
      done();
    });
    nc.publish('foo', data);
  });

  it('should include the correct reply in the callback', function(done) {
    var nc = NATS.connect(PORT);
    var data = 'Hello World';
    var inbox = nc.createInbox();
    nc.subscribe('foo', function(msg, reply) {
      msg.should.exist;
      msg.should.equal(data);
      reply.should.exist;
      reply.should.equal(inbox);
      nc.close();
      done();
    });
    nc.publish('foo', data, inbox);
  });

  it('should do request-reply', function(done) {
    var nc = NATS.connect(PORT);
    var initMsg = 'Hello World';
    var replyMsg = 'Hello Back!';

    nc.subscribe('foo', function(msg, reply) {
      msg.should.exist;
      msg.should.equal(initMsg);
      reply.should.exist;
      reply.should.match(/_INBOX\.*/);
      nc.publish(reply, replyMsg);
    });

    nc.request('foo', initMsg, function(reply) {
      reply.should.exist;
      reply.should.equal(replyMsg);
      nc.close();
      done();
    });

  });

  it('should return a sub id for requests', function(done) {
    var nc = NATS.connect(PORT);
    var initMsg = 'Hello World';
    var replyMsg = 'Hello Back!';
    var expected = 1;
    var received = 0;

    // Add two subscribers. We will only receive a reply from one.
    nc.subscribe('foo', function(msg, reply) {
      nc.publish(reply, replyMsg);
    });

    nc.subscribe('foo', function(msg, reply) {
      nc.publish(reply, replyMsg);
    });

    var sub = nc.request('foo', initMsg, function(reply) {
      nc.flush(function() {
        received.should.equal(expected);
        nc.close();
        done();
      });

      received += 1;
      nc.unsubscribe(sub);
    });
  });

  it('should do single partial wildcard subscriptions correctly', function(done) {
    var nc = NATS.connect(PORT);
    var expected = 3;
    var received = 0;
    nc.subscribe('*', function() {
      received += 1;
      if (received == expected) {
        nc.close();
        done();
      }
    });
    nc.publish('foo.baz'); // miss
    nc.publish('foo.baz.foo'); // miss
    nc.publish('foo');
    nc.publish('bar');
    nc.publish('foo.bar.3'); // miss
    nc.publish('baz');
  });

  it('should do partial wildcard subscriptions correctly', function(done) {
    var nc = NATS.connect(PORT);
    var expected = 3;
    var received = 0;
    nc.subscribe('foo.bar.*', function() {
      received += 1;
      if (received == expected) {
        nc.close();
        done();
      }
    });
    nc.publish('foo.baz'); // miss
    nc.publish('foo.baz.foo'); // miss
    nc.publish('foo.bar.1');
    nc.publish('foo.bar.2');
    nc.publish('bar');
    nc.publish('foo.bar.3');
  });

  it('should do full wildcard subscriptions correctly', function(done) {
    var nc = NATS.connect(PORT);
    var expected = 5;
    var received = 0;
    nc.subscribe('foo.>', function() {
      received += 1;
      if (received == expected) {
        nc.close();
        done();
      }
    });
    nc.publish('foo.baz');
    nc.publish('foo.baz.foo');
    nc.publish('foo.bar.1');
    nc.publish('foo.bar.2');
    nc.publish('bar');  // miss
    nc.publish('foo.bar.3');
  });

  it('should pass exact subject to callback', function(done) {
    var nc = NATS.connect(PORT);
    var subject = 'foo.bar.baz';
    nc.subscribe('*.*.*', function(msg, reply, subj) {
      subj.should.exist;
      subj.should.equal(subject);
      nc.close();
      done();
    });
    nc.publish(subject);
  });

  it('should do callback after publish is flushed', function(done) {
    var nc = NATS.connect(PORT);
    nc.publish('foo', done);
  });

  it('should do callback after flush', function(done) {
    var nc = NATS.connect(PORT);
    nc.flush(done);
  });

  it('should not receive data after unsubscribe call', function(done) {
    var nc = NATS.connect(PORT);
    var received = 0;
    var expected = 1;

    var sid = nc.subscribe('foo', function() {
      nc.unsubscribe(sid);
      received += 1;
    });

    nc.publish('foo');
    nc.publish('foo');
    nc.publish('foo', function() {
      received.should.equal(expected);
      nc.close();
      done();
    });
  });

});
