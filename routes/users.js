const express = require('express');
const router = express.Router();
const passport = require('passport');
const Promise = require('bluebird');

const mongoService = require('../services/mongo-service');
const userService = require('../services/user-service');
const validateService = require('../services/validate-service');

const Follower = require('../models/follower').Follower;
const User = require('../models/user').User;
const Notification = require('../models/notification').Notification;

const config = require('../config/config');
const restrict = require('../auth/restrict');

const E = require('../errors');

var async = require('async');

router.post('/create', function(req, res, next) {

  var user = req.body;

  // Fix for auto login after new user save
  req.body.email = req.body.new_email;
  req.body.password = req.body.new_password;

  async.waterfall([
    function(next){

      validateService.validate([{fn:'userData', data:user}], function(err){
        if (err) { return next({error: err}); }
        next();
      });
    },
    function(next){

      validateService.validate([{fn:'password', data:user.new_password}], function(err){
        if (err) { return next({error: err}); }
        next();
      });
    },
    function(next){

      userService.bcryptCreatePassword(user.new_password, function(err, hash){
        if (err) { return next({error: err}); }
        next(null, hash);
      });
    },
    function(hash, next){

      var new_user = {
        first_name: user.new_first_name,
        last_name: user.new_last_name,
        organization: user.new_organization,
        email: user.new_email.toLowerCase(),
        password: hash
      };

      mongoService.saveNew(new_user, User, function(err) {
        if (err) { return next({error: err}); }
        next();
      });
    },
    function(next){

      passport.authenticate('local', function(err, user, info) {
        if (err) { return next(err); }
        if (!user) { return next({error: info.message}); }
        next(null, user);
      })(req, res, next);
    },
    function(user, next){

      req.logIn(user, function(err) {
        if (err) { return next(err); }
        next(null, {user: {id: user._id}});
      });
    }

  ], function (err, result) {
    if(err){ res.json(err); }
    res.json(result);
  });

});

/* Fixed */
router.post('/list', restrict, function(req, res, next){

    var response = {};

    var q = {};
    q.args = {_id: {'$ne':req.user._id }};
    q.select =  'first_name last_name organization image_thumb last_modified';
    q.sort = {first_name: 1};

    mongoService.findWithPromise(q, User)
    .then(function (users) {

        if(!users || users.length === 0) { return Promise.reject(new E.NotFoundError('no users found')); }

        response.users = JSON.parse(JSON.stringify(users));

        var q = {};
        q.args = { follower: req.user._, removed: null };
        q.select = 'following';

        return mongoService.findWithPromise(q, Follower);
    })
    .then(function (following){

        if(following.length > 0){
            for(var i = 0; i < response.users.length; i++){
                for(var j = 0; j < following.length; j++){
                    if(response.users[i]._id === following[j].following ){
                        response.users[i].following = "following";
                    }
                }
            }
        }

        res.status(200).json(response);
    })
    .catch(E.Error, function (err) {
        return res.status(err.statusCode).send(err.message);
    })
    .catch(function (error) {
        console.log(error);
        return res.status(500).send('could not copy scenario');
    });

});

/* Fixed */
router.get('/single/:id', function(req, res, next) {

  var params = req.params;
  if (!params.id) { return res.sendStatus(404); }
  var response = {};

  var q = {};
  q.where = {"_id": params.id};
  q.update = { $inc: { profile_views: 1 }};
  q.select = "-password -resetPasswordExpires -resetPasswordToken";

  mongoService.updateWithPromise(q, User)
  .then(function (user) {
      if(!user) { return Promise.reject(new E.NotFoundError('no user with such id')); }

      response.profile = user;

      // following
      var followingQ = {};
      followingQ.args = {follower: params.id, removed: null };
      followingQ.populated_fields = [];
      followingQ.populated_fields.push({
        field: 'following',
        populate: 'first_name last_name image_thumb last_modified'
      });

      // find followers
      var followerQ = {};
      followerQ.args = { following: params.id, removed: null };
      followerQ.populated_fields = [];
      followerQ.populated_fields.push({
        field: 'follower',
        populate: 'first_name last_name image_thumb last_modified'
      });

      return Promise.props({
          following: mongoService.findWithPromise(followingQ, Follower),
          followers: mongoService.findWithPromise(followerQ, Follower)
      });
  })
  .then(function (meta) {
      if(meta.following.length > 0){ response.following = meta.following; }
      if(meta.followers.length > 0){ response.followers = meta.followers; }

      return res.status(200).json(response);
  })
  .catch(E.Error, function (err) {
      return res.status(err.statusCode).send(err.message);
  })
  .catch(function (error) {
      console.log(error);
      return res.status(500).send('could not copy scenario');
  });
});

router.post('/login', function(req, res, next) {
    //console.log(req.body);
    if (req.body.remember_me) { req.session.cookie.maxAge = config.cookieMaxAge; }

    async.waterfall([
      function(next){

        // using req.body.email & password
        passport.authenticate('local', function(err, user, info) {
          if (err) { return next(err); }
          if (!user) { return next({error: info.message}); }
          next(null, user);
        })(req, res, next);
      },
      function(user, next){

        req.logIn(user, function(err) {
          if (err) { return next(err); }
          next(null, {user: {id: user._id, lang: user.lang}});
        });
      }

    ], function (err, result) {
      if(err){ res.json(err); }
      res.json(result);
    });

});

router.get('/logout', restrict, function(req, res, next) {
  req.logout();
  req.session.destroy();
  res.json({success: 'logout sucessfull'});
});

router.get('/me', function(req, res){
  //http://toon.io/understanding-passportjs-authentication-flow/
  if(!req.session.passport.user){
    return res.status(401).send({error: 'Unauthorized'});
  }else{
    return res.status(200).json(req.user);
  }
});

router.post('/notifications/',restrict , function(req, res, next) {

  var user_id = req.body.user._id;

  var q = {};
  q.args = { user: user_id, type: 'comment' };
  q.populated_fields = [];
  q.populated_fields.push({
    field: 'data.user',
    populate: 'first_name last_name last_modified image_thumb'
  });
  q.populated_fields.push({
    field: 'data.scenario',
    populate: 'name '
  });
  q.select = '-type';
  q.sort = { created: -1 };
  if(typeof req.body.limit !== 'undefined'){
    q.limit = req.body.limit;
  }

  mongoService.find(q, Notification, function(err, notifications){
    if (err) { return res.json({error: err}); }
    res.json({ notifications: notifications });
  });

});

router.post('/reset-password', function(req, res, next) {

  var user = req.body;

  async.waterfall([
    function(next){

      var q = {};
      q.args = {"resetPasswordToken": user.token};

      mongoService.findOne(q, User, function(err, user_from_db) {
        if (err) { return next({error: err}); }
        if(!user_from_db){ return next({error: {id: 10, message: 'Request new token'}}); }
        next(null, user_from_db);
      });
    },
    function(user_from_db, next){

      if(user_from_db.resetPasswordExpires < Date.now()){ return next({error: {id: 11, message: 'Token expired'}}); }

      validateService.validate([{fn:'passwordReset', data:user}], function(err){
        if (err) { return next({error: err}); }
        next(null, user_from_db);
      });
    },
    function(user_from_db, next){

      userService.bcryptCreatePassword(user.new_password, function(err, hash){
        if (err) { return next({error: err}); }
        next(null, user_from_db, hash);
      });
    },
    function(user_from_db, new_password, next){

      var update = {
        password: new_password,
        last_modified: new Date(),
        resetPasswordToken: ''
      };
      var q = {};
      q.where = {"_id": user_from_db._id};
      q.update = update;

      mongoService.update(q, User, function(err, u_user){
        if (err) { return next({error: err}); }
        next(null, {success: 'success'});
      });
    },
  ], function (err, result) {
    if(err){ res.json(err); }
    res.json(result);
  });

});

router.post('/send-reset-token', function(req, res){

  var user_email = req.body.reset_email;

  async.waterfall([
    function(next){

      validateService.validate([{fn:'email', data:user_email}], function(err){
        if (err) { return next({error: err}); }
        next();
      });
    },
    function(next){

      var q = {};
      q.args = {"email": user_email.toLowerCase()};

      mongoService.findOne(q, User, function(err, user){
        if (err) { return next({error: err}); }
        if (!user) { return next({error: {id: 20, message: 'No user with that email'}}); }
        next(null, user);
      });
    },
    function(user, next){

      userService.cryptoCreateToken(function(err, token){
        if (err) { return next({error: err}); }
        next(null, user, token);
      });
    },
    function(user, token, next){

      var update = {
        resetPasswordToken: token,
        resetPasswordExpires : Date.now() + 3600000, // 1 hour
      };
      var q = {};
      q.where = {"_id": user._id};
      q.update = update;
      q.select = "email resetPasswordToken";

      mongoService.update(q, User, function(err, user){
        if (err) { return next({error: err}); }
        next(null, user);
      });
    },
    function(user, next){

      userService.sendPasswordResetMail(user, function(err, success){
        if (err) { return next({error: err}); }
        next(null, {success: success});
      });
    }

  ], function (err, result) {
    if(err){ res.json(err); }
    res.json(result);
  });

});

router.post('/save-language', restrict, function(req, res, next) {

  async.waterfall([
    function(next){

      if(!req.body.lang){ return next({error: "no lang"}); }

      var update = {};

      var q = {};
      q.where = {"_id": req.user._id};
      q.update = {lang: req.body.lang};
      q.select = "-password -resetPasswordExpires -resetPasswordToken";

      mongoService.update(q, User, function(err, u_user){
        if (err) { return next({error: err}); }
        next(null, {success: 'saved lang:'+u_user.lang});
      });
    }
  ], function (err, result) {
    if(err){ res.json(err); }
    res.json(result);
  });

});

router.post('/update-password', restrict, function(req, res, next) {

  var user = req.body.user;

  async.waterfall([
    function(next){

      validateService.validate([{fn:'passwordUpdate', data:user}], function(err){
        if (err) { return next({error: err}); }
        next();
      });
    },
    function(next){

      mongoService.findById(user._id, User, function(err, user_obj_from_db){
        if (err) { return next({error: err}); }
        if (!user_obj_from_db) { return next({error: {id: 21, message: 'No user with that id'}}); }
        next(null, user_obj_from_db.password);
      });
    },
    function(hash, next){

      userService.bcryptCompare(user.password, hash, function(err, is_match){
        if (err) { return next({error: err}); }
        if(!is_match){ return next({error: {id: 10, message: 'Wrong password'}}); }
        return next();
      });
    },
    function(next){

      userService.bcryptCreatePassword(user.new_password, function(err, hash){
        if (err) { return next({error: err}); }
        next(null, hash);
      });
    },
    function(new_password, next){

      var update = {
        password: new_password,
        last_modified: new Date()
      };
      var q = {};
      q.where = {"_id": user._id};
      q.update = update;
      q.select = "_id";

      mongoService.update(q, User, function(err, u_user){
        if (err) { return next({error: err}); }
        next(null, {user: {id: u_user._id}});
      });
    }
  ], function (err, result) {
    if(err){ res.json(err); }
    res.json(result);
  });

});

router.post('/update-profile', restrict, function(req, res, next) {

  var user = req.body.user;

  async.waterfall([
    function(next){

      validateService.validate([{fn:'userData', data:user}], function(err){
        if (err) { return next({error: err}); }
        next();
      });
    },
    function(next){

      if(user.email != user.new_email){
        if(!user.confirm_password){ return next({error: {id: 7, message: 'Please enter password to confirm email change!'}}); }

        var q = {};
        q.args = {"email": user.new_email.toLowerCase()};

        mongoService.findOne(q, User, function(err, user_with_same_email){
          if (err) { return next({error: err}); }
          if(user_with_same_email){ return next({error: {id: 6, message: 'That email is already in use'}}); }
          // true to get user and check password
          return next(null, user, true);
        });
      }else{
        // email not changed, skip next 3 fn in waterfall
        next(null, user, false);
      }
    },
    function(user, validate, next ){
      if(!validate){ return next(null, user, null); } //skip

      validateService.validate([{fn:'email', data:user.new_email}], function(err){
        if (err) { return next({error: err}); }
        return next(null, user, true);
      });
    },
    function(user, get_user, next){
      if(!get_user){ return next(null, user, null, null); } //skip

      mongoService.findById(user._id, User, function(err, user_obj_from_db){
        if (err) { return next({error: err}); }
        if (!user_obj_from_db) { return next({error: {id: 21, message: 'No user with that id'}}); }

        // true to get user and compare passwds
        return next(null, user, user_obj_from_db.password, true);
      });
    },
    function(user, hash, compare_passwds, next){
      if(!compare_passwds){ return next(null, user, null); } //skip

      userService.bcryptCompare(user.confirm_password, hash, function(err, is_match){
        if (err) { return next({error: err}); }
        if(!is_match){ return next({error: {id: 10, message: 'Wrong password'}}); }
        return next(null, user, true);
      });
    },
    function(user, change_email, next){

      var update = {};
      if(user.first_name != user.new_first_name){ update.first_name = user.new_first_name; }
      if(user.last_name != user.new_last_name){ update.last_name = user.new_last_name; }
      if(user.organization != user.new_organization){ update.organization = user.new_organization; }
      update.last_modified = new Date();
      if(change_email){ update.email = user.new_email; }

      var q = {};
      q.where = {"_id": user._id};
      q.update = update;
      q.select = "-password -resetPasswordExpires -resetPasswordToken";

      mongoService.update(q, User, function(err, u_user){
        if (err) { return next({error: err}); }
        next(null, {user: u_user});
      });
    }
  ], function (err, result) {
    if(err){ res.json(err); }
    res.json(result);
  });

});

module.exports = router;