require('./util/fontdeck');

var SVG = require('./svg');
var Promise = require('promise');
var radio = require('radio');
var XHR = require('./util/xhr');
var _ = require('lodash');

var sortPoints = require('./util/sortPoints');
var isMobile = require('./util/mobile').any;

data = SVG('svg');
data.dir = '/data/floored/test/';
data.element = document.getElementById('svg');
data.panel = document.getElementById('panel');
data.protofit = document.getElementById('protofit');
data.info = document.getElementById('info');
data.loading = document.getElementById('loading');
data.northArrow = document.getElementById('north-arrow');
data.logo = document.getElementById('project-logo');
data.rsfInput = document.getElementById('rsf-input');
data.appContainer = document.getElementById('app');
data.measurement = document.getElementById('measurement');

// Get selected cells
data.selected = [];

XHR.get(data.dir + '/config.json')

// Parse config file and configure SVG canvas
.then(function(response) {
  data.config = JSON.parse(response);

  // Give the SVG a size
  data.viewbox(0, 0, data.config.width, data.config.height);

  // Make sure we preserve the aspect ratio and hug (0, 0)
  data.attr({
    'preserveAspectRatio': 'xMinYMin'
  });

  data.$element = $('#' + data.element.id);
  data.$element.css({
    // 'position': 'absolute',
    'backface-visibility': 'hidden'
  });

  // Set up UI elements
  data.northArrow.setAttribute('style', 'transform: rotate(' + data.config.north.direction + 'deg)');
  data.logo.setAttribute('style', 'background-image: url("' + data.dir + data.config.client.logo + '")');
  data.rsfInput.value = data.config.project.area;
})

// Create layers
.then(function() {
  data.config.layers.map(function(layer, index) {
    layer.file_path = data.dir + layer.id + '.svg';
    layer.element = document.createElement('div');
    layer.element.id = layer.id;

    document.getElementById('svg').appendChild(layer.element);

    layer.$element = $('#' + layer.id);
    layer.$element.css({
      'background-image': 'url(' + layer.file_path + ')',
    });
  });

  // Add background shadow
  $('#svg-bg').css({
    'background-image': 'url(' + data.dir + 'bg.svg)'
  });
})

// Load cell data
.then(function() {
  return XHR.get(data.dir + 'cells.svg');
})

// Process cell data
.then(function(cells) {
  // Grab all cells from cells.svg. We assume they are groups of line segments.
  var cells = data.svg(cells);

  // Extract unique line segment ends to find corners of each cell
  data.cells = cells.roots()[0].children().map(function(cell, index) {

    // Grab all line segment ends
    var corners = cell.children().map(function(line) {
      return [{
        x: line.attr('x1'),
        y: line.attr('y1')
      }, {
        x: line.attr('x2'),
        y: line.attr('y2')
      }];
    });

    // Flatten and remove duplicates
    corners = _(corners).flattenDeep()
      .remove(function(item, pos, self) {
        for (var i = pos + 1; i < self.length; i++)
          if (_.isEqual(item, self[i]))
            return false;
        return true
      }).value();

    // Sort points in clockwise order
    sortPoints(corners);

    return {
      index: index,
      corners: corners
    };
  })

  // Remove cells from DOM. We will be redrawing them later
  cells.remove();
})

.then(function() {

  // Create cells
  data.cells.map(function(cell) {
    cell.path = data.path();
    cell.path.node.setAttribute('class', 'cell');
    cell.corners.map(function(corner, index) {
      if (index == 0) {
        cell.path.M(corner.x, corner.y);
      } else {
        cell.path.L(corner.x, corner.y);
      }
    });
    cell.path.Z();

    if (isMobile) {
      cell.path.touchstart(function(event) {
        // Broadcast a cell click event, no dragging
        radio('cell-click').broadcast(cell, false);
      });
    } else {
      cell.path.mousedown(function(event) {
        radio('cell-click').broadcast(cell, false);
        data.dragging = true;
      });
      cell.path.mouseover(function(event) {
        if (data.dragging) {
          radio('cell-click').broadcast(cell, true);
        } else {
          radio('cell-mouseover').broadcast(cell);
        }
      });
      cell.path.mouseout(function(event) {
        radio('cell-mouseout').broadcast(cell);
      });
      cell.path.mouseup(function(event) {
        radio('cell-mouseup').broadcast(cell);
        data.dragging = false;
      });
    }
  })
})

.then(function() {

  var transformCellClips = function() {
    return data.cells.map(function(cell) {
      var ratio = document.getElementById(data.node.id).clientWidth / data.config.width;

      var transformedCorners = cell.corners.map(function(corner) {
        return {
          x: corner.x * ratio,
          y: corner.y * ratio
        };
      });

      cell.clip = data.path();
      transformedCorners.map(function(corner, index) {
        if (index == 0) {
          cell.clip.M(corner.x, corner.y);
        } else {
          cell.clip.L(corner.x, corner.y);
        }
      });
      cell.clip.Z();
      cell.clip.remove();
    });
  };

  var setClipCSS = function($element, svg) {
    $element.css({
      '-webkit-clip-path': 'url(#' + svg.node.id + ')',
      'clip-path': 'url(#' + svg.node.id + ')'
    });
  };

  var clipLayersWithLayout = function(layout) {
    var layers = data.config.layers;
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].id !== 'shell') {
        for (var j = 0; j < layout.length; j++) {
          if (layout[j] == i) {
            layers[i].clip.add(data.cells[j].clip);
            data.cells[j].path.node.dataset.layer = i;
          }
        }
      }
    }
  };

  var clearClipsFromLayers = function() {
    var layers = data.config.layers;
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].id !== 'shell') {
        layers[i].clip.remove();
      }
    }
  }

  var createClipsForLayers = function() {
    var layers = data.config.layers;
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].id !== 'shell') {
        layers[i].clip = data.clip();
        setClipCSS(layers[i].$element, layers[i].clip);
      }
    }
  };

  var setLayout = function(layout, update) {
    if (update) clearClipsFromLayers();
    createClipsForLayers();
    transformCellClips();
    clipLayersWithLayout(layout);
  }

  setLayout(data.config.layouts[0].state);
  $(window).resize(function() {
    setLayout(data.config.layouts[0].state);
  });
})

// At the very end, remove the loading icon
.then(function() {
  setTimeout(function() {
    $(data.appContainer).removeClass('loading');
  }, 750);
  // $('#loading').remove();
}, function(error) {
  console.log(error);
});

radio('cell-click').subscribe(function(cell, dragging) {
  var index = data.selected.indexOf(cell.index);

  if (dragging) {

  } else {
    data.multiSelectState = index > -1;
  }

  // Unhighlight cell
  // if we mouse down on first cell and already selected
  // if we mouse over other selected cells and first cell was selected to begin with
  if ((!dragging && data.multiSelectState) || (index > -1 && dragging && data.multiSelectState)) {
    data.selected.splice(index, 1);
    // remove class
    var pathElement = document.getElementById(cell.path.node.id);
    pathElement.dataset.selected = 0;
  }

  // Highlight cell
  // if we mouse down on first cell and not already selected
  // if we mouse over other selected cell and first cell was not selected to begin with
  else if ((!dragging && !data.multiSelectState) || (index == -1 && dragging && !data.multiSelectState)) {
    data.selected.push(cell.index);
    // add class
    var pathElement = document.getElementById(cell.path.node.id);
    pathElement.dataset.selected = 1;
  }
});

radio('cell-mouseover').subscribe(function(cell) {
  cell.path.node.dataset.hover = 1;
});

radio('cell-mouseout').subscribe(function(cell) {
  cell.path.node.dataset.hover = 0;
});


$('#layout-next-btn').click(function() {
  $('#actions').addClass('show-editor');
});
$('#editor-back-btn').click(function() {
  $('#actions').removeClass('show-editor');
});