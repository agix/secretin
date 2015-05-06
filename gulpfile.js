var gulp  = require('gulp');
var mocha = require('gulp-mocha');
var gutil = require('gulp-util');
var babel = require('gulp-babel');
var build = require('gulp-build');

gulp.task('mocha', function() {
  return gulp.src(['test/*.js'], { read: false })
      .pipe(mocha({ compilers: 'js:babel/register', reporter: 'list' }))
      .on('error', gutil.log);
});

gulp.task('babel', function() {
  return gulp.src('app/scripts/**')
    .pipe(babel())
    .pipe(gulp.dest('dist/scripts'));
});

gulp.task('build', function() {
  return gulp.src('app/*.html')
      .pipe(build())
      .pipe(gulp.dest('dist'))
});

gulp.task('watch', function() {
  gulp.watch(['app/scripts/**'], ['mocha', 'babel']);
  gulp.watch(['test/**'], ['mocha']);
  gulp.watch(['app/*.html'], ['build']);
});

gulp.task('default', ['mocha', 'babel', 'build', 'watch']);