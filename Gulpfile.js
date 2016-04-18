/**
 * Created by Meki on 2015.02.25..
 */

/* Get dependencies */
var gulp = require('gulp'),
    sass = require('gulp-sass'),
    minifycss = require('gulp-cssnano'),
    plumber = require( 'gulp-plumber' ),
    jshint = require('gulp-jshint'),
    livereload = require('gulp-livereload'),
    uglify = require('gulp-uglify'),
    imagemin = require('gulp-imagemin'),
    rename = require('gulp-rename'),
    concat = require('gulp-concat'),
    notify = require('gulp-notify'),
    cache = require('gulp-cache'),
    sourcemaps = require('gulp-sourcemaps'),
    autoprefixer = require('gulp-autoprefixer'),
    sassdoc = require('sassdoc'),
    del = require('del');


var onError = function( err ) {
  console.log( 'An error occurred:', err.message );
  this.emit( 'end' );
}
/* Set paths */

var paths = {
    /* Source paths */
    styles: ['assets/sass/main.scss'],
    scripts: [
        'assets/bower_components/jquery/dist/jquery.js',
        'assets/bower_components/jquery.easing/js/jquery.easing.js',
        'assets/bower_components/bootstrap/dist/js/bootstrap.js',
        'assets/js/ui.js',
        'assets/js/responsive.js',
        'assets/js/media-player.js'
    ],
    fonts: [
        'assets/bower_components/bootstrap/fonts/*',
        'assets/bower_components/font-awesome/fonts/*'
    ],

    /* Output paths */
    stylesOutput: 'styles',
    scriptsOutput: 'ui/ui',
    imagesOutput: 'images',
    fontsOutput: 'fonts'
};

var sassOptions = {
  errLogToConsole: true,
  outputStyle: 'expanded'
};

var autoprefixerOptions = {
  browsers: ['last 2 versions', '> 5%', 'Firefox ESR']
};

/* Tasks */

gulp.task('styles', function () {
  return gulp
    .src(paths.styles)
    .pipe(sourcemaps.init())
    .pipe(sass(sassOptions).on('error', sass.logError))
    .pipe(sourcemaps.write())
    .pipe(autoprefixer(autoprefixerOptions))
    .pipe(gulp.dest(paths.stylesOutput))
     .pipe(rename({suffix: '.min'}))
     .pipe(minifycss())
     .pipe(gulp.dest(paths.stylesOutput))
     .pipe(notify({ message: 'Styles task complete' }));

});

gulp.task('styles', function () {
  return gulp
    .src(paths.styles)
    .pipe(sass(sassOptions).on('error', sass.logError))
    .pipe(gulp.dest(paths.stylesOutput));
});

gulp.task('scripts', function() {
    return gulp.src(paths.scripts)
        .pipe(concat('main.js'))
        .pipe(gulp.dest(paths.scriptsOutput))
        .pipe(rename({suffix: '.min'}))
        .pipe(uglify())
        .pipe(gulp.dest(paths.scriptsOutput))
        .pipe(notify({ message: 'Scripts task complete' }));
});

// gulp.task('images', function() {
//     return gulp.src(paths.images)
//         .pipe(cache(imagemin({ optimizationLevel: 5, progressive: true, interlaced: true })))
//         .pipe(gulp.dest(paths.imagesOutput))
//         .pipe(notify({ message: 'Images task complete' }));
// });

gulp.task('fonts', function() {
    return gulp.src(paths.fonts)
    .pipe(gulp.dest(paths.fontsOutput))
    .pipe(notify({ message: 'Fonts task complete', onLast: true }));
});

gulp.task('watch', function() {
  return gulp
    // Watch the input folder for change,
    // and run `sass` task when something happens
    .watch('assets/sass/*/**.scss', ['styles'])
    // When there is a change,
    // log a message in the console
    .on('change', function(event) {
      console.log('File ' + event.path + ' was ' + event.type + ', running tasks...');
    });
});



gulp.task('clean', function(cb) {
    del([paths.stylesOutput, paths.scriptsOutput, paths.imagesOutput, paths.fontsOutput], cb)
});

gulp.task('default', function() {
    gulp.start('styles', 'scripts', 'fonts', 'watch');
});
