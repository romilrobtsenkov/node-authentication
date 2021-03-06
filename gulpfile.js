/* File: gulpfile.js */

// grab our gulp packages
const gulp   = require('gulp');
const gutil = require('gulp-util');
const jshint = require('gulp-jshint');
const sourcemaps = require('gulp-sourcemaps');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const jsonminify = require('gulp-jsonminify');
const size = require('gulp-size');
const cleanCSS = require('gulp-clean-css');

gulp.task('default', ['jshint', 'build-js', 'minify-languages', 'minify-css']);

gulp.task('jshint', function() {
    return gulp.src('public/js/app/**/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('watch', function() {
    gulp.watch('public/js/app/**/*.js', ['jshint']);
});

gulp.task('build-js', function() {

    return gulp.src([
        'public/bower/angular/angular.min.js',
        'public/bower/angular-route/angular-route.min.js',
        'public/bower/angular-resource/angular-resource.min.js',
        'public/bower/angular-sanitize/angular-sanitize.min.js',
        'public/bower/lodash/dist/lodash.min.js',
        'public/bower/angularjs-dropdown-multiselect/dist/angularjs-dropdown-multiselect.min.js',
        'public/bower/angular-utils-pagination/dirPagination.js',
        'public/bower/ng-file-upload/ng-file-upload-shim.min.js',
        'public/bower/ng-file-upload/ng-file-upload.min.js',
        'public/bower/angular-ui-sortable/sortable.min.js',
        'public/bower/angular-translate/angular-translate.min.js',
        'public/bower/angular-translate-loader-static-files/angular-translate-loader-static-files.min.js',
        'public/bower/ng-tags-input/ng-tags-input.min.js',
        'public/bower/angular-ui-notification/dist/angular-ui-notification.min.js',
        'public/js/app/app.js',
        'public/js/app/route-config.js',
        'public/js/app/translate-config.js',
        'public/js/app/main/main.js',
        'public/js/app/home/home.js',
        'public/js/app/login/login.js',
        'public/js/app/signup/signup.js',
        'public/js/app/create/create.js',
        'public/js/app/edit-details/edit-details.js',
        'public/js/app/edit-publish/edit-publish.js',
        'public/js/app/edit/edit.js',
        'public/js/app/scenario/scenario.js',
        'public/js/app/scenario-text/scenario-text.js',
        'public/js/app/user/user.js',
        'public/js/app/reset/reset.js',
        'public/js/app/settings/settings.js',
        'public/js/app/dashboard/dashboard.js',
        'public/js/app/search/search.js',
        'public/js/app/tags/tags.js',
        'public/js/app/modal/modal.js',
        'public/js/app/services/queryService.js',
        'public/js/app/services/requestService.js',
        'public/js/app/services/userAuthService.js',
        'public/js/app/directives/timeline/timeline.js',
        'public/js/app/directives/modal/modal.js',
        'public/js/app/directives/scenario/scenario.js',
        'public/js/app/directives/checkImage/checkImage.js',
        'public/js/app/filters/prefixHttp.js',
    ])
    //.pipe(sourcemaps.init())
    .pipe(size())
    .pipe(concat('leplanner-min.js'))
    //only uglify if gulp is ran with '--type production'
    // gulp build-js --type production
    //.pipe(gutil.env.type === 'production' ? uglify() : gutil.noop())
    .pipe(uglify())
    //.pipe(sourcemaps.write())
    .pipe(gulp.dest('public/js/min'));
});

gulp.task('minify-languages', function() {

    var lang_files = [
        'public/localization/*.json'
    ];

    return gulp.src(lang_files)
    .pipe(jsonminify())
    .pipe(gulp.dest('public/localization/min'));
});

gulp.task('minify-css', function() {
    return gulp.src([
        'public/bower/ng-tags-input/ng-tags-input.min.css',
        'public/bower/ng-tags-input/ng-tags-input.bootstrap.min.css',
        'public/bower/angular-ui-notification/dist/angular-ui-notification.min.css',
        'public/stylesheets/style.css',
    ])
    .pipe(cleanCSS({debug: true}, function(details) {
        console.log(details.name + ': ' + details.stats.originalSize);
        console.log(details.name + ': ' + details.stats.minifiedSize);
    }))
    .pipe(concat('style.css'))
    .pipe(gulp.dest('public/stylesheets/min'));
});
