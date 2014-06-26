var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	assert = require('assert');

/*
	docs - a set of documents or a mongodb cursor, passed in from the output of a MongoDB fetch all call initially
	callback - a function matching the signature f(err, result) where result is an EventEmitter; this will emit new events as each document is ready for writing.
*/

var _stringify = function(obj){
	return JSON.stringify(obj, null, 4);
};

var _hostAddress = '';

var _render = function(docs, hostAddress){
	var emitter = new EventEmitter(),
		stateArrays = {
			Backlog: [],
			Working: [],
			QA: [],
			Done: []
		},
		docsRendered = 0;

	_hostAddress = hostAddress || '';
	// remove trailing slash from host if present
	if(_hostAddress.length > 0 && _hostAddress.charAt(_hostAddress.length - 1) == '/')
		_hostAddress = _hostAddress.substr(0, _hostAddress.length - 1);

	// iterate through each the documents
	docs.each(function(err, doc){
		if(doc){
			// transform the document into the desired JSON document
			var rep = _createBugsRepresentation(doc),
				resID = '/bugs/' + doc._id.toHexString() + '.json';

			// emit the JSON document
			emitter.emit('resource', { identifier: resID, data: _stringify(rep) });

			docsRendered += 1;

			// based on the status add subset of document to one or more state arrays
			assert(	_.contains(_.keys(stateArrays), doc.status), 
				'Status \'' + doc.status + '\' is not a recognized bug state.');
			stateArrays[doc.status].push(doc);
		} else {
			// iterate through each of the state arrays
			_.keys(stateArrays).forEach(function(key){
				var rep = _createBugsRepresentation(stateArrays[key]),
					resID = '/bugs/' + key.toLowerCase() + '.json';
			
				// emit each as a json document
				emitter.emit('resource', { identifier: resID, data: _stringify(rep) });
			
				docsRendered += 1;
			})
				
			// emit the index page 
			emitter.emit('resource',  { identifier: '/bugs.json', data: _stringify(_createIndexRepresentation()) });
			
			docsRendered += 1;

			emitter.emit('end', docsRendered);
		}
	});	

	return emitter;
};

var _addNavigationLinks = function(r){
	// todo: make these absolute URLs
	r.index = _hostAddress + '/bugs.json';
	r.backlog = _hostAddress + '/bugs/backlog.json';
    r.working = _hostAddress + '/bugs/working.json';
    r.qa = _hostAddress + '/bugs/qa.json';
    r.done = _hostAddress + '/bugs/done.json';
	
	return r;
};

var _createMoveForm = function(bug, actionUrl){
	var ret = {
		href: actionUrl,
		method: 'POST',
		parameters: [{ id: bug._id.toHexString() }, 'comments']
	};
	ret['content-type'] = 'application/x-www-form-urlencoded';

	return ret;
};

var _addBugStateChangeForms = function(r, b){
	assert(b.status, 'Bug must contain status property to generate a representation');
	switch(b.status){
		case 'Backlog':
			r.move_working = _createMoveForm(b, _hostAddress + '/bugs/working.json');
			break;
		case 'Working':
			r.move_backlog = createMoveForm(b, _hostAddress + '/bugs/backlog.json');
			r.move_qa = createMoveForm(b, _hostAddress + '/bugs/qa.json');
			break;
		case 'QA':
			r.move_working = _createMoveForm(b, _hostAddress + '/bugs/working.json');
			r.move_done = _createMoveForm(b, _hostAddress + '/bugs/done.json');
			break;
		case 'Done':
			r.move_working = _createMoveForm(b, _hostAddress + '/bugs/working.json');
			break;
	}
}

var _createBugDetails = function(b){
	var bugRepresentation = b;
	_addBugStateChangeForms(bugRepresentation, b);
	return bugRepresentation;
};


var _createBugsRepresentation = function(data){
	var representation = {};
	representation = _addNavigationLinks(representation);
	if(_.isArray(data)){
		console.info('create representation for list of bugs');
		representation.bugs = [];

		data.forEach(function(bug){
			var b = {
				title: bug.title,
				description: bug.description
			};
			_addBugStateChangeForms(b, bug);
			representation.bugs.push(b);
		});
	} else {
		console.info('Creating representation for single bug');
		representation.bugs = [ _createBugDetails(data) ];
	}
	return representation;
};

var _createIndexRepresentation = function(){
	var representation = {};
	representation = _addNavigationLinks(representation);
	representation.create_bug = {
		href: _hostAddress + '/bugs/backlog',
        method: 'POST',        
        parameters: ['title', 'description']
	};
	representation.create_bug['content-type'] = 'application/x-www-form-urlencoded'; 
	return representation; 
};

exports.render = _render;