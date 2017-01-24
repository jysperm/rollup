const gulp = require('gulp');
const less = require('gulp-less');
const babel = require('gulp-babel');
const uglify = require('gulp-uglify');
const webpack = require('gulp-webpack');
const cleanCss = require('gulp-clean-css');

gulp.task('frontend-styles', () => {
  return gulp.src('styles/main.less')
    .pipe(less({paths: ['node_modules/bootstrap/less']}))
    .pipe(cleanCss())
    .pipe(gulp.dest('public'));
});

gulp.task('components', () => {
  return gulp.src('components/*.jsx')
    .pipe(babel({
      presets: ['es2015'],
      plugins: ['transform-react-jsx']
    }))
    .pipe(gulp.dest('public'));
});

gulp.task('bundled', ['components'], () => {
  return gulp.src('public/index.js')
    .pipe(webpack({
      output: {
        filename: 'index.bundled.js'
      }
    }))
    .pipe(uglify())
    .pipe(gulp.dest('public'));
});

gulp.task('watch', ['default'], () => {
  gulp.watch(['components/*.jsx'], ['bundled']);
});

gulp.task('default', ['bundled', 'frontend-styles']);
