(function() {
  'use strict';

  angular
    .module('app')
    .controller('UserController', UserController);

    UserController.$inject = ['$scope','$rootScope','$routeParams','userService','scenarioService'];

    function UserController($scope,$rootScope,$routeParams,userService,scenarioService) {

      if(typeof $routeParams.id !== 'undefined'){
        $scope.get_profile_id = $routeParams.id;
      }else{
        $location.path('/');
      }

      if(typeof $rootScope.sort_tab === 'undefined'){
        $rootScope.sort_tab = {};
      }else if(typeof $rootScope.sort_tab.profile === 'undefined') {
        $rootScope.sort_tab.profile = 'latest';
      }

      $scope.sidebox_quantity = {};
      $scope.sidebox_quantity.followings = 8;
      $scope.sidebox_quantity.followers = 8;

      getSingleUserScenarios();
      getUserData();

      function getUserData(){

        var request = {
          user: {
            _id: $scope.get_profile_id
          }
        };

        userService.loadUserData(request)
          .then(function(data) {

            if(data.profile){
              //console.log(data);
              $scope.profile = data.profile;

              //check if user is following
              if(typeof $rootScope.user === 'undefined'){
                $scope.is_following = false;
              }else if(typeof data.followers === 'undefined'){
                $scope.is_following = false;
              }else{
                for(var i = 0; i < data.followers.length; i++){
                  //console.log($rootScope.user._id +' == '+ data.followers[i]._id);
                  if($rootScope.user._id == data.followers[i]._id){
                    // following user
                    $scope.is_following = true;
                    break;
                  }
                }
              }

              //console.log(data.following);

              if(typeof data.following !== 'undefined'){
                $scope.followings = data.following;
              }else{
                $scope.followings = undefined;
              }

              if(typeof data.followers !== 'undefined'){
                $scope.followers = data.followers;
              }else{
                $scope.followers = undefined;
              }

            }

            if(data.error){
              switch (data.error.id) {
                case 0:
                  $scope.no_user = true;
                  break;
                default:
                  $scope.no_user = true;
                  console.log(data.error);
              }
            }

        });
      }

      $scope.addRemoveFollow = function(remove_follow){

        var params = {
          user: {
            _id: $rootScope.user._id
          },
          following: {
            _id: $scope.get_profile_id
          }
        };

        if(typeof remove_follow !== 'undefined'){
          params.remove_follow = true;
        }

        userService.addRemoveFollow(params)
          .then(function(data) {

            if(data.success){
              //console.log(data.success);
              if(data.success == 'unfollow'){
                $scope.is_following = false;
              }else{
                $scope.is_following = true;
              }
              getUserData();
            }

            if(data.error){
              switch (data.error.id) {
                case 100:
                  // user changed
                  $location.path('/');
                  break;
                default:
                  console.log(data.error);

              }
            }
        });
      };

      function getSingleUserScenarios(){

        $scope.loading_animation = true;
        $scope.no_scenarios = false;
        $scope.scenarios = [];

        var q = {};

        q.user = {_id: $scope.get_profile_id};

        if(typeof $rootScope.sort_tab.profile == 'undefined'){
          $rootScope.sort_tab.profile = 'latest';
        }else{
          switch ($rootScope.sort_tab.profile) {
            case 'latest':
                q.order = 'latest';
              break;
              case 'popular':
                  q.order = 'popular';
                break;
              case 'favorited':
                  q.order = 'favorited';
                break;
              case 'commented':
                  q.order = 'commented';
                break;
            default:
              q.order = 'latest';
          }
        }

        scenarioService.getUserScenarios(q)
          .then(function(data) {
            //console.log(data);
            if(data.scenarios){
              if(data.scenarios.length === 0){
                  $scope.no_scenarios = true;
              }
              $scope.scenarios = data.scenarios;

              $scope.loading_animation = false;
            }

            if(data.error){
              console.log(data.error);
            }
        });


      }

      $scope.isSortActive = function(tab){
        if(tab == $rootScope.sort_tab.profile){ return true; }
        return false;
      };

      $scope.updateSortList = function(tab){
        if(tab == 'latest ' || tab == 'popular' || tab == 'favorited' || tab == 'commented'){
          $rootScope.sort_tab.profile = tab;
          getSingleUserScenarios();
        }else{
          $rootScope.sort_tab.profile = 'latest';
          getSingleUserScenarios();
        }
      };

      $scope.expandSideBox = function(box_name){
        switch (box_name) {
          case 'followings':
            $scope.sidebox_quantity.followings = undefined;
            break;
          case 'followers':
            $scope.sidebox_quantity.followers = undefined;
            break;
          default:
            console.log('no name');
        }
      };

    }
}());
