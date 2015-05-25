var gulp  = require('gulp');
var mocha = require('gulp-mocha');
var gutil = require('gulp-util');
var babel = require('gulp-babel');
var build = require('gulp-build');
var uglify = require('gulp-uglify');
var rename = require("gulp-rename");

gulp.task('mocha', function() {
  return gulp.src(['test/*.js'], { read: false })
      .pipe(mocha({ compilers: 'js:babel/register', reporter: 'list' }))
      .on('error', gutil.log);
});

gulp.task('babel', function() {
  return gulp.src('app/scripts/**')
    .pipe(babel())
    //.pipe(uglify())
    .pipe(gulp.dest('dist/scripts'));
});

gulp.task('babelserv', function() {
  gulp.src('app/scripts/main.js')
    .pipe(babel())
    //.pipe(uglify())
    .pipe(gulp.dest('server/client/scripts'));
  gulp.src('app/scripts/User.js')
    .pipe(babel())
    //.pipe(uglify())
    .pipe(gulp.dest('server/client/scripts'));
  gulp.src('app/scripts/APIserv.js')
    .pipe(babel())
    //.pipe(uglify())
    .pipe(rename("API.js"))
    .pipe(gulp.dest('server/client/scripts'));
  gulp.src('app/scripts/lib/**')
    .pipe(babel())
    //.pipe(uglify())
    .pipe(gulp.dest('server/client/scripts/lib'));
});

gulp.task('build', function() {
  return gulp.src('app/*.html')
      .pipe(build())
      .pipe(gulp.dest('dist'))
});


gulp.task('buildserv', function() {
  return gulp.src('app/indexServ.html')
      .pipe(build())
      .pipe(rename('index.html'))
      .pipe(gulp.dest('server/client'))
});

gulp.task('watch', function() {
  gulp.watch(['app/scripts/**'], ['mocha', 'babel', 'babelserv']);
  gulp.watch(['test/**'], ['mocha']);
  gulp.watch(['app/*.html'], ['build', 'buildserv']);
});

gulp.task('default', ['mocha', 'babel', 'babelserv', 'build', 'buildserv', 'watch']);