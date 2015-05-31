var gulp  = require('gulp');
var gutil = require('gulp-util');
var build = require('gulp-build');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var jshint = require('gulp-jshint');
var tar = require('gulp-tar');
var gzip = require('gulp-gzip');

gulp.task('buildLocal', function() {
  gulp.src('app/index.html')
    .pipe(build())
    .pipe(gulp.dest('dist'))
  gulp.src('app/scripts/main.js')
    .pipe(gulp.dest('dist/scripts'));
  gulp.src('app/scripts/User.js')
    .pipe(gulp.dest('dist/scripts'));
  gulp.src('app/scripts/API.js')
    .pipe(gulp.dest('dist/scripts'));
  gulp.src('app/scripts/lib/**')
    .pipe(gulp.dest('dist/scripts/lib'));
});


gulp.task('buildServ', function() {
  gulp.src('app/indexServ.html')
    .pipe(build())
    .pipe(rename('index.html'))
    .pipe(gulp.dest('server/client'))

  gulp.src('app/scripts/mainServ.js')
    .pipe(rename('main.js'))
    .pipe(gulp.dest('server/client/scripts'));
  gulp.src('app/scripts/User.js')
    .pipe(gulp.dest('server/client/scripts'));
  gulp.src('app/scripts/APIServ.js')
    .pipe(rename('API.js'))
    .pipe(gulp.dest('server/client/scripts'));
  gulp.src('app/scripts/lib/**')
    .pipe(gulp.dest('server/client/scripts/lib'));
});

gulp.task('watch', function() {
  gulp.watch(['app/scripts/**'], ['buildLocal', 'buildServ']);
  gulp.watch(['app/*.html'], ['buildLocal', 'buildServ']);
});

gulp.task('default', ['buildLocal', 'buildServ', 'watch']);

gulp.task('jshint', function() {
  gulp.src('app/scripts/APIServ.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default'));

  gulp.src('app/scripts/User.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default'));

  gulp.src('app/scripts/lib/**')
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('deploy', function() {
  gulp.src(['server/clien*/**', 'server/index.js', 'server/install.js', 'server/package.json'])
    .pipe(tar('secretin.tar'))
    .pipe(gzip())
    .pipe(gulp.dest('dist'));
});