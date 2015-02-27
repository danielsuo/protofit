# protofit

For setup instructions, see docs/Setup.md.

## Example
Navigate to URL
```
http://localhost:3000/?client=floored&project=test
```

## To Do
- Add empty cell to layers
- Add plan background
- Add seating data
- Add area data
- Clear canvas
- Use gulp-watch, not gulp.watch
- [browser events](https://github.com/mudcube/Event.js)
- Modules
- iPad

# Ideas that improve file size
- Minify and optimize svg via svgo
- Turn elements into a single large path
- Render SVG icons with webfonts. Example [here](http://frozeman.de/blog/2013/08/why-is-svg-so-slow/)

# Ideas that improve performance
- Reduce number of redraws
- Use CSS transforms on HTML element holding SVG, not on SVG directly
- Use rounded coordinates. Example [here](https://www.mapbox.com/osmdev/2012/11/20/getting-serious-about-svg/)

# Ideas that improve both performance and file size
- Use CSS to style SVG elements, rather than per-element styling
- Cut up SVG layers into cells and only load what is needed
- Remove unnecessary layers and paths
- Use SVG to represent blocks and floor plan only
