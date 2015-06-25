var fs = require('fs');
var crypto = require('crypto');

function Subscriptions(source){
	this._source = source;
	this._subscriptions = { };
	try {
		fs.mkdirSync(source, 0700);
		console.log('[Initializing] Creating subscriptions directory.');
	}
	catch(e){
		if(e.code == 'EEXIST'){
			console.log('[Initializing] Loading files from subscription directory.');
			var files = fs.readdirSync(source);
			files.forEach(function(file){
				var data = fs.readFileSync(source + '/' + file);
				this._subscriptions[file] = new Subscription(JSON.parse(data));
			}, this);
		}
	}
}

Subscriptions.prototype.add = function(cbPath, subName, hub, topic, secret){
	var sub = new Subscription({
		'_source' : this._source,
		'_name' : subName,
		'_path' : cbPath,
		'_hub' : hub,
		'_topic' : topic,
		'_state' : state.validating
	});
	this._subscriptions[subName] = sub;
	save.call(sub);
	return sub;
}

Subscriptions.prototype.subExists = function(subName){
	return this._subscriptions[subName] !== undefined;
}

Subscriptions.prototype.del = function(subName){
	delete this._subscriptions[subName];
}

Subscriptions.prototype.getSubByName = function(subName){
	return this._subscriptions[subName];
}

Subscriptions.prototype.getSubByPath = function(cbPath){
	for(sub in this._subscriptions){
		if(this._subscriptions[sub]._path === cbPath)
			return this._subscriptions[sub];
	}
}

var state = {
	validating : 0,
	subscribed : 1,
	unsubscribing : 2,
	unsubscribed : 3
}

function Subscription(options){
	for(param in options){
		this[param] = options[param];
	}
}

Subscription.prototype.isValidating = function(){
	return this._state === state.validating;
}

Subscription.prototype.isUnsubscribing = function(){
	return this._state === state.unsubscribing;
}

Subscription.prototype.auth = function(challenge){
	if(this._secret){
		var mac = crypto.createHmac('sha1', challenge);
		mac.update(challenge);
		if(this._secret === mac.digest('hex')){
			return true;
		} 
	}
	returun false;	
}

Subscription.prototype.markSubscribed = function(){
	console.log('[Subscription] Now changed to subscribed.');
	this._state = state.subscribed;
	save.call(this);
}

Subscription.prototype.markUnsubscribing = function(){
	console.log('[Subscription] Now changed to unsubscribing.');
	this._state = state.unsubscribing;
	save.call(this);
}

Subscription.prototype.markUnsubscribed = function(){
	console.log('[Subscription] Now changed to unsubscribed.');
	this._state = state.unsubscribed;
	save.call(this);
}

function save(){
	var that = this;
	fs.writeFile(this._source + '/' + this._name, JSON.stringify(this), function(err){
		if(err)
			console.log('[Error] ' + err);
		else
			console.log('[Success] Subscription file: ' + that._name + ' was saved.');
	});
}

module.exports = {
	load: function(dir){
		return new Subscriptions(dir);
	}
}
