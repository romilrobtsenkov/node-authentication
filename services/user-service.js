var bcrypt = require('bcrypt');
var crypto = require('crypto');
var nodemailer = require('nodemailer');
var config = require('../config/config');
var User = require('../models/user').User;
var Scenario = require('../models/scenario').Scenario;
var ScenarioView = require('../models/scenario-view').ScenarioView;
var Comment = require('../models/comment').Comment;
var Follower = require('../models/follower').Follower;

exports.addUser = function(user, next) {

  //BETA
  if(!user.new_beta_code){
    return next({id: 'beta', message: 'Please enter required beta code!'});
  }else if(user.new_beta_code != config.beta_code){
    return next({id: 'wrong_beta', message: 'Wrong beta code!'});
  }


  // prevalidate user input before db, if html validation fails
  if(!user.new_first_name){ return next({id: 0, message: 'Please enter your first name'}); }
  if(!user.new_last_name){ return next({id: 1, message: 'Please enter your last name'}); }
  if(!user.new_email){ return next({id: 2, message: 'Please enter your email'}); }
  if(user.new_email.match(/[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/) === null){
    return next({id: 3, message: 'Please enter correct email'});
  }
  if(!user.new_password){ return next({id: 4, message: 'Please enter your password'}); }
  if(user.new_password.length < 8){ return next({id: 5, message: 'Password has to be min 8 chars long'}); }

  user.hashedpassword = user.new_password;

    bcrypt.hash(user.new_password, 10, function(err, hash) {
      if (err) { return next(err); }

      user.hashedpassword = hash;
      var newUser = new User({
        first_name: user.new_first_name,
        last_name: user.new_last_name,
        organization: user.new_organization,
        email: user.new_email.toLowerCase(),
        password: user.hashedpassword
      });

      newUser.save(function(err) {
        if (err) {
          if(err.errors.email.message == 'That email is already in use'){
            return next({id: 6, message: 'That email is already in use'});
          }else{
            return next(err);
          }
        }
        next(null);
      });
    });

};

exports.findByEmail = function(email, next) {
  User.findOne({email: email.toLowerCase()}, function(err, user) {
    //console.log(user);
    next(err, user);
  });
};

exports.findById = function(id, next) {
  User.findById(id, function(err, user) {
    next(err, user);
  });
};

exports.updateUserProfile = function(user, next) {
  // prevalidate user input before db, if html validation fails
  if(!user.new_first_name){ return next({id: 0, message: 'Please enter your first name'}); }
  if(!user.new_last_name){ return next({id: 1, message: 'Please enter your last name'}); }
  if(!user.new_email){ return next({id: 2, message: 'Please enter your email'}); }
  if(user.new_email.match(/[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/) === null){
    return next({id: 3, message: 'Please enter correct email'});
  }

  var update = {};
  if(user.first_name != user.new_first_name){
    update.first_name = user.new_first_name;
  }
  if(user.last_name != user.new_last_name){
    update.last_name = user.new_last_name;
  }
  if(user.organization != user.new_organization){
    update.organization = user.new_organization;
  }

  update.last_modified = new Date();

  if(user.email != user.new_email){

    if(!user.confirm_password){
      return next({id: 7, message: 'Please enter password to confirm email change!'});
    }

    User.findOne({email: user.new_email}, function(err,user_with_same_email) {
      if (err) { return next(err); }
      if(user_with_same_email){
        return next({id: 6, message: 'That email is already in use'});
      }else{
        update.email = user.new_email;
        User.findOne({_id: user._id}, function(err,user_object) {
          if (err) { return next(err); }

            bcrypt.compare(user.confirm_password, user_object.password, function(err, same) {
              if (err) { return next(err); }

              if(same){
                updateProfile(update);
              }else{
                return next({id: 10, message: 'Wrong password'});
              }

            });

        });
      }
    });
  }else{
    updateProfile(update);
  }

  function updateProfile(update){

    var query = {"_id": user._id};
    var options = {new: true};
    User.findOneAndUpdate(query, update, options, function(err, user) {
      if (err) { return next(err); }
      if(user){
        return next(null, user);
      }
    });
  }

};

exports.updateUserPassword = function(user, next) {
  // prevalidate user input before db, if html validation fails
  if(!user.password || !user.new_password || !user.new_password_twice){ return next({id: 7, message: 'Please enter all fields'}); }
  if(user.password.length < 8 || user.new_password.length < 8 || user.new_password_twice.length < 8){ return next({id: 5, message: 'Password has to be min 8 chars long'}); }
  if(user.password == user.new_password){ return next({id: 8, message: 'New password has to be different from old one'}); }
  if(user.new_password != user.new_password_twice){ return next({id: 9, message: 'New passwords dont match'}); }

  User.findOne({_id: user._id}, function(err,user_object) {
    if (err) { return next(err); }

      bcrypt.compare(user.password, user_object.password, function(err, same) {
        if (err) { return next(err); }

        if(same){

          bcrypt.hash(user.new_password, 10, function(err, hash) {
            if (err) { return next(err); }

            var update = {
              password: hash,
              last_modified: new Date()
            };

            var query = {"_id": user._id};
            var options = {new: true};
            User.findOneAndUpdate(query, update, options, function(err, user) {
              if (err) { return next(err); }
              if(user){
                return next(null, user);
              }
            });
          });

        }else{
          return next({id: 10, message: 'Wrong password'});
        }

      });

  });

};

exports.recoverUser = function(email, next) {

  if(email.match(/[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/) === null){
    return next({id: 3, message: 'Please enter correct email'});
  }
  User.findOne({email: email}, function(err,user) {

    if (err) { return next(err); }
    if (!user) { return next({id: 20, message: 'No user with that email'}); }

    // replace with token later -http://sahatyalkabov.com/how-to-implement-password-reset-in-nodejs/
    crypto.randomBytes(20, function(err, buf) {
      if (err) { return next(err); }

      var update = {
        resetPasswordToken: buf.toString('hex'),
        resetPasswordExpires : Date.now() + 3600000, // 1 hour
      };
      var query = {"_id": user._id};
      var options = {new: true};
      User.findOneAndUpdate(query, update, options, function(err, user) {
        if (err) { return next(err); }

        if(user){
          return next(null, user);
        }

      });

    });

  });

};

exports.sendUserMail = function(user, next) {
  //send email
  nodemailer.sendmail = true;
    var transporter = nodemailer.createTransport({
      debug: true, //this!!!
    });
    var mailOptions = {
      to: user.email,
      from: 'romilr@tlu.ee',
      subject: 'Password Reset',
      text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
        'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
        'http://http://node-authentication.eu/#/reset/' + user.resetPasswordToken + '\n\n' +
        'If you did not request this, please ignore this email and your password will remain unchanged.\n'
    };

    transporter.sendMail(mailOptions, function(err) {
      //console.log(err);
      if (err) { return next(err); }
      return next(null, 'done');
    });

};

exports.resetPassword = function(user, next) {

  User.findOne({resetPasswordToken: user.token}, function(err,user_db) {
    if (err) { return next(err); }
    if(!user_db){
      return next({id: 10, message: 'Request new token'});
    }
    if(user_db.resetPasswordExpires > Date.now()){

      if(!user.new_password || !user.new_password_twice){ return next({id: 7, message: 'Please enter all fields'}); }
      if(user.new_password.length < 8 || user.new_password_twice.length < 8){ return next({id: 5, message: 'Password has to be min 8 chars long'}); }
      if(user.new_password != user.new_password_twice){ return next({id: 9, message: 'New passwords dont match'}); }

      bcrypt.hash(user.new_password, 10, function(err, hash) {
        if (err) { return next(err); }

        var update = {
          password: hash,
          resetPasswordToken: undefined,
          resetPasswordExpires: undefined,
          last_modified: new Date()
        };

        var query = {"_id": user_db._id};
        var options = {new: true};
        User.findOneAndUpdate(query, update, options, function(err, user) {
          if (err) { return next(err); }
          if(user){
            return next(null, user);
          }
        });
      });

    }else{
      return next({id: 11, message: 'Token expired'});
    }

  });

};

exports.loadUserData = function(q, next) {

    // update profile view count
    var query = User.findOne();
    query.where({"_id": q.user._id});
    query.exec(function(err, profile) {
      if (err) return next(err);
      if(profile === null){
        return next({id: 0, message: "no such profile found"});
      }

      var update = {profile_views: profile.profile_views+1};
      var query = {"_id": profile._id};
      var options = {new: true};
      User.findOneAndUpdate(query, update, options, function(err, user) {
        if (err) { return next(err); }

        user.password = undefined;
        user.email = undefined;
        if(user.resetPasswordToken){user.resetPasswordToken = undefined;}
        if(user.resetPasswordExpires){user.resetPasswordExpires = undefined;}

        // get following and followers alphabetical order
        var following_query = Follower.find();
        args = {};
        multiple_args = [];
        multiple_args.push({follower: user._id});
        multiple_args.push({following: user._id});
        args.$or = multiple_args;
        following_query.where(args);
        following_query.populate('follower','first_name last_name image_thumb last_modified');
        following_query.populate('following','first_name last_name image_thumb last_modified');
        following_query.exec(function(err, follow_array) {
          if (err) return next(err);
          //console.log(follow_array.length);

          var response = {};
          response.profile = user;

          // create separate arrays for followers and following
          if(follow_array.length > 0){
            for(var i = 0; i < follow_array.length; i++){

              // could not compare to objects -> .toString() fixed
              if(follow_array[i].follower._id.toString() == user._id.toString()){
                // following
                if(typeof response.following === 'undefined'){
                  response.following = [];
                }
                response.following.push({
                  _id: follow_array[i].following._id,
                  first_name: follow_array[i].following.first_name,
                  last_name: follow_array[i].following.last_name,
                  image_thumb: follow_array[i].following.image_thumb,
                  last_modified: follow_array[i].following.last_modified
                });

              }else if(follow_array[i].following._id.toString() == user._id.toString()){
                // followers
                if(typeof response.followers === 'undefined'){
                  response.followers = [];
                }
                response.followers.push({
                  _id: follow_array[i].follower._id,
                  first_name: follow_array[i].follower.first_name,
                  last_name: follow_array[i].follower.last_name,
                  image_thumb: follow_array[i].follower.image_thumb,
                  last_modified: follow_array[i].follower.last_modified
                });

              }

            }
          }

          return next(null, response);
        });

      });

    });

};

exports.addRemoveFollow = function(params, next){

  if(typeof params === 'undefined'){return next('no params sent');}
  if(params.user._id == params.following._id){ return next("can not follow yourself");}
  if(!params.user._id){return next("no user data sent");}
  if(!params.following._id){return next("to follow/unfollow not sent");}

  var query = Follower.findOne();
  var args = {};
  var multiple_args = [];
  multiple_args.push({follower: params.user._id});
  multiple_args.push({following: params.following._id});
  args.$and = multiple_args;
  query.where(args);
  query.exec(function(err, follow_doc) {
    if (err) return next(err);

    if(typeof params.remove_follow === 'undefined'){

      // follow
      if(follow_doc === null){

        follow_doc = {
          follower: params.user._id,
          following: params.following._id
        };

        new_follow_doc = new Follower(follow_doc);
        new_follow_doc.save(function(err, favorite){
          if(err){ return next(err); }

          Follower.count({follower: params.user._id}, function (err, count) {
            // update user following count
            var update = {following_count: count};
            var query = {"_id": params.user._id};
            var options = {new: true};
            User.findOneAndUpdate(query, update, options, function(err, user) {
              if (err) { return next(err); }

              // update other user followers count
              Follower.count({following: params.following._id}, function (err, count) {
                var update = {followers_count: count};
                var query = {"_id": params.following._id};
                var options = {new: true};
                User.findOneAndUpdate(query, update, options, function(err, user) {
                  if (err) { return next(err); }
                  return next(null, {success: 'follow'});
                });

              });

            });

          });

        });

      }else{
        //already following
        return next(null, {success: 'follow'});
      }

    }else{

      // unfollow
      if(follow_doc === null){
        // already not following
        return next(null, {success: 'unfollow'});
      }else{
        // unfollow that user
        follow_doc.remove(function(err, a){
          if (err) return next(err);

          Follower.count({follower: params.user._id}, function (err, count) {
            // update user following count
            var update = {following_count: count};
            var query = {"_id": params.user._id};
            var options = {new: true};
            User.findOneAndUpdate(query, update, options, function(err, user) {
              if (err) { return next(err); }
              return next(null, {success: 'unfollow'});
            });

          });

        });
      }
    }

  });

};

exports.getNotifications = function(req, next) {

    // get user scenarios
    var args = {};
    args.deleted = false;
    args.draft = false;
    args.author = req.user._id;
    query = Scenario.find();
    query.where(args);
    query.select('_id');
    query.exec(function(err, scenarios) {

      var list_of_scenario_ids = [];
      for(var i = 0; i< scenarios.length; i++){
        list_of_scenario_ids[i] = scenarios[i]._id;
      }

      //get list of comments on those scenarios
      var args = {};
      args.deleted = false;
      var filter_args = [];
      filter_args.push({scenario: { $in : list_of_scenario_ids }});
      args.$and = filter_args;
      query = Comment.find();
      query.populate('author', 'first_name last_name last_modified image_thumb');
      query.populate('scenario', 'name');
      query.where(args);
      query.sort({created: 1});
      query.exec(function(err, comments) {
        if (err) return next(err);

        var list_of_commented_scenario_ids = [];
        var k = 0;

        for(var i = 0; i< comments.length; i++){
          if(list_of_commented_scenario_ids.indexOf(comments[i].scenario._id) == -1){
            list_of_commented_scenario_ids[k] = comments[i].scenario._id;
            k++;
          }
        }

        //get views on commented scenarios
        var args = {};
        args.user = req.user._id;
        var filter_args = [];
        filter_args.push({scenario: { $in : list_of_commented_scenario_ids }});
        args.$and = filter_args;
        query = ScenarioView.aggregate([
          { $match: {scenario: { $in : list_of_commented_scenario_ids } }},
          { $group: { _id: '$scenario', view: {$addToSet : {user: '$user', date: '$date'}}}},
          { $sort: { date: -1 } }
        ]);
        query.exec(function(err, scenario_views) {
          if (err) return next(err);

          createNotifications(comments, scenario_views);

        });

      });

    });

    function createNotifications(comments, scenario_views){

      //console.log(views.length);
      var notifications = [];

      //check if there are comments in user scenarios
      for(var k = 0; k < comments.length; k++){
        for(var i = 0; i < scenario_views.length; i++){
          for(var j = 0; j < scenario_views[i].view.length; j++){

            // if user viewed, check the latest comment date and compare with latest user view date
            if(scenario_views[i].view[j].user == req.user._id && scenario_views[i]._id.toString() == comments[k].scenario._id.toString()){

                var notification = {
                  user: {
                    _id: comments[k].author._id,
                    first_name: comments[k].author.first_name,
                    last_name: comments[k].author.last_name,
                    last_modified: comments[k].author.last_modified,
                    image_thumb: comments[k].author.image_thumb,
                  },
                  comment: {
                    created: comments[k].created,
                    scenario: {
                      _id: comments[k].scenario._id,
                      name: comments[k].scenario.name
                    }
                  }
                };

                if(comments[k].created > scenario_views[i].view[j].date){
                  notification.new = true;
                }

                notifications.push(notification);

                // add only one from view list
                break;

            }
          }
        }
      }

      //order by comment date
      notifications = notifications.sort(notificationsSortFunction);
      function notificationsSortFunction(a, b) {
        if (a.comment.created === b.comment.created) {
          return 0;
        }
        else {
          return (a.comment.created > b.comment.created) ? -1 : 1;
        }
      }

      if(typeof req.limit !== 'undefined'){
        notifications = notifications.slice(0, req.limit);
      }

      return next(null, {notifications: notifications});
    }


};

exports.getUsersList = function(req, next) {
  //console.log(req.user._id);

  query = User.find();
  query.where({_id: {'$ne':req.user._id }});
  query.select('first_name last_name organization image_thumb last_modified');
  query.sort({first_name: 1});
  query.exec(function(err, users) {
    if (err) return next(err);

    var following_query = Follower.find();
    following_query.where({follower: req.user._id});
    following_query.select('following');
    following_query.exec(function(err, following) {
      if (err) return next(err);

      var response = {
        users: users
      };

      if(following){response.following = following;}

      return next(null, response);
    });

  });

};
