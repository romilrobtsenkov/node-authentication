const express = require('express');
const request = require('request');
const router = express.Router();
const restrict = require('../auth/restrict');
const mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
const Promise = require('bluebird');
const fs = require('fs');
Promise.promisifyAll(fs);

const mongoService = require('../services/mongo-service');
const scenarioService = require('../services/scenario-service');
const metaService = require('../services/meta-service');
const screenshotService = require('../services/screenshot-service');

const Scenario = require('../models/scenario').Scenario;
const Comment = require('../models/comment').Comment;
const Notification = require('../models/notification').Notification;
const Favorite = require('../models/favorite').Favorite;
const Follower = require('../models/follower').Follower;
const Material = require('../models/activity-material').Material;
const User = require('../models/user').User;

const E = require('../errors');
const log = require('../logger');
const config = require('../config/config');

router.get('/copy/:id', restrict, function(req, res) {

    var params = req.params;
    if (!params.id) { return res.sendStatus(404); }

    var response;

    log.notice(req.user._id + ' creates copy of ' +params.id);

    // find parent to copy
    var q = {};
    q.args = { _id: params.id };

    mongoService.findOne(q, Scenario)
    .then(function (scenario) {

        if(!scenario) { return Promise.reject(new E.NotFoundError('no scenario with such id')); }

        //add mother_scenario params.id
        //change user
        var newOne = scenario;
        newOne.name = "[copy] "+scenario.name;
        newOne.mother_scenario = scenario._id;

        newOne._id = mongoose.Types.ObjectId();
        newOne.isNew = true; //<--------------------IMPORTANT

        newOne.author = req.user._id;
        newOne.created = new Date();
        newOne.favorites_count = 0;
        newOne.comments_count = 0;
        newOne.view_count = 0;
        newOne.draft = true;
        newOne.last_modified = new Date();

        return mongoService.saveNew(newOne, Scenario);
    })
    .then(function (newScenario) {

        log.notice('saved new copy');
        response = { _id: newScenario._id };

        // Find all materials
        var q = {};
        q.args = {
            scenario: params.id,
            deleted: false
        };

        return mongoService.find(q, Material);
    })
    .then(function (materials) {

        if(materials.length === 0){ return Promise.resolve(); }

        for(var i = 0; i < materials.length; i++){
            materials[i]._id = mongoose.Types.ObjectId();
            materials[i].isNew = true; //<--------------------IMPORTANT
            materials[i].created = new Date();
            materials[i].last_modified = new Date();
            materials[i].scenario = response._id; //<--------------------NEW SCENARIO ID
        }

        return Material.create(materials);
    })
    .then(function (savedMaterials) {

        if (savedMaterials) { log.notice('materials added:' + savedMaterials.length); }

        return res.status(200).json(response);
    })
    .catch(E.Error, function (err) {
        return res.status(err.statusCode).send(err.message);
    })
    .catch(function (error) {
        log.error(error);
        return res.status(500).send('could not copy scenario');
    });

});

router.post('/', restrict, function(req, res) {

    var params = req.body;

    if(!params.scenario ||
        !params.scenario.name || !params.scenario.description ||
        params.scenario.name.length <= 2 || params.scenario.description.length <= 2 ){

        return res.sendStatus(404);
    }

    var newScenario = params.scenario;
    newScenario.author = req.user._id;
    newScenario.draft = true;
    newScenario.last_modified = new Date();

    mongoService.saveNew(newScenario, Scenario)
    .then(function (scenario){
        res.json({ _id: scenario._id } );
    })
    .catch(function (err) {
        log.error(err);
        res.json({error: err});
    });

});

router.post('/delete/:id', restrict, function(req, res) {

    var params = req.params;

    if (!params.id) { return res.sendStatus(404); }

    var q = {};
    q.args = { _id: params.id, author: req.user._id, deleted: false };

    mongoService.findOne(q, Scenario)
    .then(function (scenario) {
        if (!scenario) { return Promise.reject(new E.ForbiddenError('not your scenario or already deleted')); }

        var q = {};
        q.where = { _id: params.id };
        q.update = {
            deleted: true
        };
        q.select = '_id';

        return mongoService.update(q, Scenario);
    })
    .then(function () {

        return res.status(200).send('deleted');
    })
    .catch(E.Error, function (err) {
        return res.status(err.statusCode).send(err.message);
    })
    .catch(function (err) {
        log.error(err);
        return res.status(500).send('deleting scenario failed due to server error');
    });

});

router.post('/single-edit/:id', restrict, function(req, res) {

    var params = req.params;
    var response = {};

    if (!params.id) { return res.sendStatus(404); }

    var q = {};
    q.args = { _id: params.id, author: req.user._id };
    q.populated_fields = [];
    q.populated_fields.push({ field: 'subjects' });

    mongoService.findOne(q, Scenario)
    .then(function (scenario) {

        if (!scenario) { return Promise.reject(new E.ForbiddenError('not your scenario')); }

        response.scenario = scenario.toJSON(); // Plain JSON obj to modify

        var q = {};
        q.args = { scenario: params.id, deleted: false };

        return Promise.props({
            materials: mongoService.find(q, Material),
            activity_organization: metaService.getActivityOrganization(),
            involvement_options: metaService.getInvolvementOptions(),
            displays: metaService.getDisplays(),
        });
    })
    .then(function (meta) {

        // add materials & other meta to scenario activities
        for(var i = 0; i < meta.materials.length; i++){
            for(var j = 0; j < response.scenario.activities.length; j++) {
                if(meta.materials[i].activity_id === response.scenario.activities[j]._id) {
                    if (!response.scenario.activities[j].materials) {
                        response.scenario.activities[j].materials = [];
                    }

                    var material = meta.materials[i].toJSON();

                    // displays
                    if(material.displays) {
                        for (var l = 0; l < material.displays.length; l++) {
                            material.displays[l] = meta.displays[material.displays[l]];
                        }
                    }

                    // involvement level name
                    material.involvement = meta.involvement_options[material.involvement_level];

                    response.scenario.activities[j].materials.push(material);
                }
            }
        }

        // activity organization
        for(var k = 0; k < response.scenario.activities.length; k++) {
            response.scenario.activities[k].activity_organization.name = meta.activity_organization[response.scenario.activities[k].activity_organization._id].name;
        }

        return res.json(response);
    })
    .catch(E.Error, function (err) {
        return res.status(err.statusCode).send(err.message);
    })
    .catch(function (err) {
        log.error(err);
        return res.status(500).send('retrieving scenario failed due to server error');
    });
});

router.get('/user/:id', function(req, res) {

    var query = req.query;
    var params = req.params;

    if (!params.id) { return res.sendStatus(404); }

    const PAGESIZE = 10;

    query.page = parseInt(query.page, 10) > 1 ? parseInt(query.page, 10) : 1;
    if(query.page < 1) {query.page = 1;}
    // fix skipping for 1
    query.page -= 1;

    Promise.resolve(scenarioService.getSortOrder(query))
    .then(function (sort) {

        var q = {};
        q.args = { author: params.id, draft: false, deleted: false};
        q.populated_fields = [];
        q.populated_fields.push({
            field: 'author',
            populate: 'first_name last_name created'
        });
        q.populated_fields.push({field: 'subjects'});
        q.sort = sort;

        q.skip = query.page * PAGESIZE;
        q.limit = PAGESIZE;

        var count_q = JSON.parse(JSON.stringify(q));
        count_q.skip = count_q.limit = undefined;

        return Promise.props({
            scenarios: mongoService.find(q, Scenario),
            count: mongoService.count(count_q, Scenario)
        });
    })
    .then(function (response) {
        return res.status(200).json(response);
    })
    .catch(function (err) {
        log.error(err);
        return res.status(500).send('retrieving scenario failed due to server error');
    });

});

router.post('/save/', restrict, function(req, res) {

    var params = req.body;

    var q = {};
    q.args = { _id: params.scenario._id, author: req.user._id };

    mongoService.findOne(q, Scenario)
    .then(function (latestScenario) {
        if (!latestScenario) { return Promise.reject(new E.ForbiddenError('not your scenario')); }

        var newScenario = params.scenario;
        newScenario.last_modified = new Date();

        // disallow in any way to change author
        if(newScenario.author.toString() !== req.user._id.toString()) { return Promise.reject(new E.ForbiddenError('not allowed to change author')); }

        // if publish tab, skip other checks
        if(params.publish) { return Promise.resolve(newScenario); }

        // Allow only positive numbers in grade, duration
        if(newScenario.grade){
            newScenario.grade = Math.abs(newScenario.grade);
        }
        if(newScenario.duration){
            newScenario.duration = Math.abs(newScenario.duration);
        }

        //fix #tags if user added hashtags in beginning
        for(var k = 0; k< newScenario.tags.length;k++){
            if (newScenario.tags[k].text && newScenario.tags[k].text.charAt(0) === '#'){
                newScenario.tags[k].text = newScenario.tags[k].text.replace(/#/g,'');

            }
        }

        //check if tags unique
        for(var l = 0; l < newScenario.tags.length; l++){
            for(var m = 0; m < newScenario.tags.length; m++){
                if (newScenario.tags[l].text === newScenario.tags[m].text && l !== m){
                    newScenario.tags.splice(l,1);
                }
            }
        }

        // reset to calculate again
        newScenario.activities_duration = 0;

        for(var i = 0; i < newScenario.activities.length; i++){
            if(!newScenario.activities[i].duration){
                // fix if user left it empty
                newScenario.activities[i].duration = 0;
            }
            newScenario.activities[i].duration = Math.abs(newScenario.activities[i].duration);
            newScenario.activities_duration += newScenario.activities[i].duration;
        }

        return Promise.resolve(newScenario);
    })
    .then(function (newScenario) {
        //update existing scenario
        var q = {};
        q.where = { _id: newScenario._id };
        q.update = newScenario;
        q.update.last_modified = new Date();

        return mongoService.update(q, Scenario);
    })
    .then(function (scenario) {

        log.notice(req.user.first_name + '(' + req.user._id + ') updated scenario: '+scenario._id);

        //create screenshot in the background
        if(!scenario.draft){
            screenshotService.create(scenario._id);
        }

        return res.status(200).json({ _id: scenario._id });
    })
    .catch(E.Error, function (err) {
        return res.status(err.statusCode).send(err.message);
    })
    .catch(function (err) {
        log.error(err);
        return res.status(500).send('saving scenario failed due to server error');
    });
});

router.post('/dashboard/', restrict, function(req, res) {

    var query = req.body;
    if(!query.tab){ query.tab = 'feed'; }

    const PAGESIZE = 10;

    if(query.page) {
        query.page = parseInt(query.page, 10) > 1 ? parseInt(query.page, 10) : 1;
        if(query.page < 1) {query.page = 1;}
        // fix skipping for 1
        query.page -= 1;
    }

    Promise.resolve(scenarioService.getSortOrder(query))
    .then(function (sort) {

        var q = {};
        q.populated_fields = [];
        q.populated_fields.push({
            field: 'author',
            populate: 'first_name last_name created'
        });
        q.populated_fields.push({ field: 'subjects' });
        q.sort = sort;
        q.skip = query.page * PAGESIZE;
        q.limit = PAGESIZE;

        switch (query.tab) {
            case 'feed':

                var followerQ = {};
                followerQ.args = {follower: query.user._id, removed: null};
                followerQ.select = 'following';

                return mongoService.find(followerQ, Follower)
                .then(function(following) {

                    var list_of_following_ids = [];
                    for(var i = 0; i< following.length; i++){
                        list_of_following_ids[i] = following[i].following;
                    }

                    q.args = { author: { $in : list_of_following_ids }, draft: false, deleted: false};

                    var count_q = JSON.parse(JSON.stringify(q));
                    count_q.skip = count_q.limit = undefined;

                    return Promise.props({
                        scenarios: mongoService.find(q, Scenario),
                        count: mongoService.count(count_q, Scenario)
                    });
                });

            case 'drafts':

                q.args = { author: query.user._id, draft: true, deleted: false};

                var count_q = JSON.parse(JSON.stringify(q));
                count_q.skip = count_q.limit = undefined;

                return Promise.props({
                    scenarios: mongoService.find(q, Scenario),
                    count: mongoService.count(count_q, Scenario)
                });

            case 'published':

                q.args = { author: query.user._id, draft: false, deleted: false};

                var count_q = JSON.parse(JSON.stringify(q));
                count_q.skip = count_q.limit = undefined;

                return Promise.props({
                    scenarios: mongoService.find(q, Scenario),
                    count: mongoService.count(count_q, Scenario)
                });

            case 'favorites':

                var favoriteQ = {};
                favoriteQ.args = {user: query.user._id, removed: null};
                favoriteQ.select = 'scenario';

                return mongoService.find(favoriteQ, Favorite)
                .then(function (favorites) {

                    if(favorites.length === 0){ return Promise.resolve({scenarios: [], count: 0}); }

                    var list_of_scenario_ids = [];
                    //create a list of scenario ids
                    for(var i = 0; i < favorites.length; i++){
                        list_of_scenario_ids.push(favorites[i].scenario);
                    }

                    q.args = { _id: { $in : list_of_scenario_ids }, draft: false, deleted: false};

                    var count_q = JSON.parse(JSON.stringify(q));
                    count_q.skip = count_q.limit = undefined;

                    return Promise.props({
                        scenarios: mongoService.find(q, Scenario),
                        count: mongoService.count(count_q, Scenario)
                    });
                });

        }
    })
    .then(function (response) {

        return res.status(200).json(response);
    })
    .catch(function (error) {
        log.error(error);
        return res.status(500).send('could not get scenarios');
    });

});

router.get('/search', function(req, res) {

    const PAGESIZE = 10;

    var query = req.query;

    query.page = parseInt(query.page, 10) > 1 ? parseInt(query.page, 10) : 1;
    if(query.page < 1) {query.page = 1;}
    // fix skipping for 1
    query.page -= 1;

    Promise.resolve(scenarioService.getSortOrder(query))
    .then(function (sort) {

        var q = {};
        q.args = { draft: false, deleted: false };

        // search word
        if(typeof query.q !== 'undefined'){
            q.args.$or = [
                { name: { "$regex": query.q, "$options": "i" } },
                { description: { "$regex": query.q, "$options": "i" } },
                { 'tags.text': { "$regex": query.q, "$options": "i" } },
            ];
        }

        // meta fields
        if(query.subjects){
            query.subjects= query.subjects.split(",");
            q.args.subject = { $in : query.subjects };
        }
        if(query.languages){
            query.languages= query.languages.split(",");
            q.args.language = { $in : query.languages };
        }

        q.populated_fields = [];
        q.populated_fields.push({
            field: 'author',
            populate: 'first_name last_name created'
        });
        q.populated_fields.push({ field: 'subjects' });
        q.sort = sort;

        q.skip = query.page * PAGESIZE;
        q.limit = PAGESIZE;

        var count_q = JSON.parse(JSON.stringify(q));
        count_q.skip = count_q.limit = undefined;

        return Promise.props({
            scenarios: mongoService.find(q, Scenario),
            count: mongoService.count(count_q, Scenario)
        });
    })
    .then(function (response) {
        /* CREATE ALL THUMBNAILS */
        /*for (var i = 0; i < response.scenarios.length; i++){
            screenshotService.create(response.scenarios[i]._id);
        }*/
        return res.status(200).json(response);
    })
    .catch(function (err) {
        log.error(err);
        return res.status(500).send('retrieving scenario failed due to server error');
    });

});

router.get('/screenshot/:id', function(req, res) {

    var params = req.params;
    var response = {};

    if (!params.id) { return res.sendStatus(404); }

    var q = {};
    q.where = {
        _id: params.id,
        draft:false,
        deleted:false
    };

    //check if valid id
    mongoService.update(q, Scenario)
    .then(function (scenario) {

        if (!scenario) { return Promise.reject(new E.NotFoundError('no scenario with such id')); }

        console.log("Creating screenshot via URL "+config.scenarios_thumb_upload_path+scenario._id+'.png');

        // check if already exists
        return fs.statAsync(config.scenarios_thumb_upload_path+scenario._id+'.png')
        .then(function (exists) {
            return true;
        }).catch(function (err) {

            if(err.code !== 'ENOENT'){
                return Promise.reject(new E.NotFoundError('no scenario with such id'));
            }else{
                // no file
                return Promise.resolve(false);
            }

        });
    })
    .then(function (exists) {

        //if screenshot already exists, return
        if(exists){
            return res.json({"error":"Screenshot already exists"});
        }

        //create new
        screenshotService.create(params.id);
        return res.json({"sucess":"Creating screenshot..."});

    })
    .catch(E.Error, function (err) {
        return res.status(err.statusCode).send(err.message);
    })
    .catch(function (err) {
        log.error(err);
        return res.status(500).send('scenario screenshot failed due to server error');
    });

});

router.get('/single/:id', function(req, res) {

    var params = req.params;
    var response = {};

    if (!params.id) { return res.sendStatus(404); }

    var q = {};
    q.where = { _id: params.id };
    q.populated_fields = [];
    q.populated_fields.push({
        field: 'author',
        populate: 'first_name last_name organization created image last_modified'
    });
    q.populated_fields.push({ field: 'subjects' });
    // mother scenario id, scenario name ja scenario author
    q.populated_fields.push({
        field: 'mother_scenario',
        populate: '_id name author'
    });
    q.update = { $inc: { view_count: 1 } };

    mongoService.update(q, Scenario)
    .then(function (scenario) {

        if(!scenario){return Promise.reject(new E.NotFoundError('no scenario with such id')); }

        response.scenario = scenario.toJSON(); // Plain JSON obj to modify

        // CHILD SCENARIOS
        var q = {};
        q.args = { mother_scenario:response.scenario._id, draft:false, deleted:false };
        q.select = "name author";
        q.populated_fields = [];
        q.populated_fields.push({
            field: 'author',
            populate: 'first_name last_name'
        });

        return mongoService.find(q, Scenario);
    })
    .then(function (childScenarios) {

        if (childScenarios && childScenarios.length > 0) {
            response.scenario.child_scenarios = childScenarios;
        }

        if (!response.scenario.mother_scenario) { return Promise.resolve(); }

        // MOTHER SCENARIO AUTHOR NAME
        var q = {};
        q.args = { _id: response.scenario.mother_scenario.author };
        q.select = "first_name last_name";

        return mongoService.findOne(q, User);
    })
    .then(function (user) {

        if (user) { response.scenario.mother_scenario.author = user; }
        if(!req.user){ return Promise.resolve(); }

        // CHECK IF IS FAVORITED OR IS FOLLOWING
        var favQ = {};
        favQ.args = { scenario: response.scenario._id, user: req.user._id };

        var folQ = {};
        folQ.args = { follower: req.user._id, following: response.scenario.author._id, removed: null };

        return Promise.props({
            favorite: mongoService.findOne(favQ, Favorite),
            following: mongoService.findOne(folQ, Follower)
        });
    })
    .then(function (obj) {

        if(obj && obj.favorite){ response.is_favorite = true; }
        if(obj && obj.following){ response.is_following = true; }

        // MARK NOTIFICATIONS SEEN
        // if author viewing if there are notifications - mark them as seen, else skip!
        if(!req.user){ return Promise.resolve(); }
        if(req.user && req.user._id.toString() !== response.scenario.author._id.toString()){ return Promise.resolve(); }

        var q = {};
        q.where = { user: req.user._id, type: 'comment', 'data.scenario': response.scenario._id, seen: null };
        q.update = { seen: new Date() };

        return mongoService.updateMultiple(q, Notification);
    })
    .then(function () {

        // GET RESOURCES AND OTHER META
        var q = {};
        q.args = { scenario: response.scenario._id, deleted: false };

        return Promise.props({
            materials: mongoService.find(q, Material),
            activity_organization: metaService.getActivityOrganization(),
            involvement_options: metaService.getInvolvementOptions(),
            displays: metaService.getDisplays(),
        });
    })
    .then(function (meta) {

        // add materials & other meta to scenario activities
        for(var i = 0; i < meta.materials.length; i++){
            for(var j = 0; j < response.scenario.activities.length; j++) {
                if(meta.materials[i].activity_id === response.scenario.activities[j]._id) {
                    if (!response.scenario.activities[j].materials) {
                        response.scenario.activities[j].materials = [];
                    }

                    var material = meta.materials[i].toJSON();

                    // displays
                    if(material.displays) {
                        for (var l = 0; l < material.displays.length; l++) {
                            material.displays[l] = meta.displays[material.displays[l]];
                        }
                    }

                    // involvement level name
                    material.involvement = meta.involvement_options[material.involvement_level];

                    response.scenario.activities[j].materials.push(material);
                }
            }
        }

        // activity organization
        for(var k = 0; k < response.scenario.activities.length; k++) {
            response.scenario.activities[k].activity_organization.name = meta.activity_organization[response.scenario.activities[k].activity_organization._id].name;
        }

        return res.json(response);
    })
    .catch(E.Error, function (err) {
        return res.status(err.statusCode).send(err.message);
    })
    .catch(function (err) {
        log.error(err);
        return res.status(500).send('retrieving scenario failed due to server error');
    });


});

router.get('/tag/', function(req, res) {

    var query = req.query;

    const PAGESIZE = 10;

    if(query.page) {
        query.page = parseInt(query.page, 10) > 1 ? parseInt(query.page, 10) : 1;
        if(query.page < 1) {query.page = 1;}
        // fix skipping for 1
        query.page -= 1;
    }

    Promise.resolve(scenarioService.getSortOrder(query))
    .then(function (sort) {

        var q = {};

        var tagRegex = '^' + query.tag;
        q.args = { 'tags.text': { "$regex": tagRegex, "$options": "i" }, draft: false, deleted: false};
        q.populated_fields = [];
        q.populated_fields.push({
            field: 'author',
            populate: 'first_name last_name created'
        });
        q.populated_fields.push({ field: 'subjects' });
        q.sort = sort;
        q.skip = query.page * PAGESIZE;
        q.limit = PAGESIZE;

        var count_q = JSON.parse(JSON.stringify(q));
        count_q.skip = count_q.limit = undefined;

        return Promise.props({
            scenarios: mongoService.find(q, Scenario),
            count: mongoService.count(count_q, Scenario)
        });
    })
    .then(function (response) {
        return res.status(200).json(response);
    })
    .catch(function (err) {
        log.error(err);
        return res.status(500).send('retrieving scenarios failed due to server error');
    });

});

router.get('/widget/', function(req, res) {

    var query = req.query;

    Promise.resolve(scenarioService.getSortOrder(query))
    .then(function (sort) {

        var q = {};
        q.args = { draft: false, deleted: false};

        // single scenario view widget, exclude scenario that is viewd and get same user scenarios
        if (query.exclude) { q.args._id = {'$ne': query.exclude }; }
        if (query.author) { q.args.author = query.author; }

        q.populated_fields = [];
        q.populated_fields.push({
            field: 'author',
            populate: 'first_name last_name created'
        });
        q.sort = sort;
        if (query.limit) { query.limit = parseInt(query.limit); }
        q.limit = query.limit;

        return mongoService.find(q, Scenario);
    })
    .then(function (scenarios) {
        return res.status(200).json({scenarios: scenarios});
    })
    .catch(function (error) {
        log.error(error);
        return res.status(500).send('could not get scenarios');
    });

});

module.exports = router;
