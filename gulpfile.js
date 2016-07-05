var gulp    = require('gulp');
var gutil   = require('gulp-util');
var build   = require('gulp-build');
var uglify  = require('gulp-uglify');
var rename  = require('gulp-rename');
var jshint  = require('gulp-jshint');
var concat  = require('gulp-concat');
var tar     = require('gulp-tar');
var gzip    = require('gulp-gzip');
var zip     = require('gulp-zip');
var exec    = require('child_process').exec;

gulp.task('buildLocal', function() {
  gulp.src('app/index.html')
    .pipe(build())
    .pipe(gulp.dest('dist'))


  gulp.src(
    [
      'app/scripts/main.js',
      'app/scripts/User.js',
      'app/scripts/APIAlone.js',
      'app/scripts/lib/**',
      'app/scripts/typeAlone.js'
    ]
  )
    .pipe(concat('main.js'))
    .pipe(gulp.dest('dist/scripts'));

  gulp.src('app/styles/**')
    .pipe(gulp.dest('dist/styles'));

  // gulp.src('app/scripts/attack.js')
  //   .pipe(gulp.dest('dist/scripts'));

  gulp.src('dist/**')
    .pipe(gulp.dest('server/client/alone'));


});

gulp.task('buildElectron', function() {

  gulp.src(
    [
      'app/scripts/mainElectron.js',
      'app/scripts/User.js',
      'app/scripts/APIAlone.js',
      'app/scripts/lib/**',
      'app/scripts/typeElectron.js'
    ]
  )
    .pipe(concat('main.js'))
    .pipe(gulp.dest('electron/scripts'));

  gulp.src('app/styles/**')
    .pipe(gulp.dest('electron/styles'));

});

gulp.task('buildServ', function() {
  gulp.src('app/index.html')
    .pipe(build())
    .pipe(gulp.dest('server/client'))

  gulp.src(
    [
      'app/scripts/main.js',
      'app/scripts/User.js',
      'app/scripts/APIServer.js',
      'app/scripts/lib/**',
      'app/scripts/typeServer.js'
    ]
  )
    .pipe(concat('main.js'))
    .pipe(gulp.dest('server/client/scripts'));

  gulp.src('app/styles/**')
    .pipe(gulp.dest('server/client/styles'));
});

gulp.task('watch', function() {
  gulp.watch(['app/scripts/**'], ['build']);
  gulp.watch(['app/styles/**'], ['build']);
  gulp.watch(['app/*.html'], ['build']);
});

gulp.task('build', ['buildLocal', 'buildServ', 'buildElectron']);

gulp.task('default', ['build', 'watch']);

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

  gulp.src('app/scripts/typeServer.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default'));

  gulp.src('app/scripts/main.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('deploy', function() {
  gulp.src('server/client/alon*/**')
    .pipe(tar('secretinAlone.tar'))
    .pipe(gzip())
    .pipe(gulp.dest('server/client'));

  gulp.src(['server/clien*/**', 'server/index.js', 'server/install.js', 'server/package.json'])
    .pipe(tar('secretin.tar'))
    .pipe(gzip())
    .pipe(gulp.dest('./'));
});

gulp.task('electron', function() {
  exec('cd electron/ && rm db.json ; rm secret-in.me-win32-x64.zip ; electron-packager ./ --platform=win32 --arch=x64 --version=1.2.5 --overwrite', function(err, stdout, stderr){
    console.log(stdout);
    console.log(stderr);
    console.log('Zipping...');
    gulp.src('electron/secret-in.me-win32-x64/**', {base: './electron/'})
      .pipe(zip('secret-in.me-win32-x64.zip'))
      .pipe(gulp.dest('electron/'));
  });
});