#!/usr/bin/env node 

var MongoClient = require('mongodb').MongoClient,
	_ = require('underscore'),
	async = require('async'),
	jsonGenerator = require('./lib/generator-json'),
	path = require('path'),
	mkdirp = require('mkdirp'),
	fs = require('fs'),
	program = require('commander');

var mongoConnectionString = process.env.RESTBUGS_DB || 'mongodb://127.0.0.1/restbugs',
	mongoConnectionOptions = {
		db: { native_parser: true }
	},
	bugsCollection = 'bugs';

program
.version('0.1.0')
.option('-h --host <address>', 'DNS host used for generating links')
.option('-o --output <path>', 'Output directory for placing generated files. Default is \'output\'')
.parse(process.argv);

// defaults
var outputDirectory = program.output || './output';

var _fileResourceWriter = function(resource){
	var outputPath = path.join(outputDirectory, resource.identifier),
		dirname = path.dirname(outputPath);

	mkdirp(dirname, function(err){
		if(err) return console.error('Error creating directory ' + dirname);
		fs.writeFile(outputPath, resource.data, function(err){
			if(err) return console.error('Error creating file ' + outputPath);
			else console.info('Succesfully created file ' + outputPath);
		});
	});
};

MongoClient.connect(mongoConnectionString, mongoConnectionOptions, function(err, db){
	if(err) return callback(err, null);
	var cursor = db.collection(bugsCollection).find();
	
	jsonGenerator.render(cursor, program.host)
	.on('resource', _fileResourceWriter)
	.on('end', function(count){
		console.info('Finished generating ' + count + ' resources.');
	});
});
