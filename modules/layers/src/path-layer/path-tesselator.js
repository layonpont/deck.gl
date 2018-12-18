// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
import Tesselator from './tesselator';
import {fp64 as fp64Module} from 'luma.gl';
const {fp64LowPart} = fp64Module;

// This class is set up to allow querying one attribute at a time
// the way the AttributeManager expects it
export default class PathTesselator extends Tesselator {
  constructor({data, getGeometry, fp64}) {
    super({
      data,
      getGeometry,
      fp64,
      attributes: {
        startPositions: {size: 3},
        endPositions: {size: 3},
        leftDeltas: {size: 3},
        rightDeltas: {size: 3},
        startEndPositions64XyLow: {size: 4, fp64: true}
      }
    });
  }

  /* Getters */
  startPositions() {
    return this.attributes.startPositions;
  }

  endPositions() {
    return this.attributes.endPositions;
  }

  startEndPositions64XyLow() {
    return this.attributes.startEndPositions64XyLow;
  }

  leftDeltas() {
    return this.attributes.leftDeltas;
  }

  rightDeltas() {
    return this.attributes.rightDeltas;
  }

  strokeWidths({target, getWidth}) {
    return this._updateAttribute({
      target,
      size: 1,
      getValue: object => [getWidth(object)]
    });
  }

  dashArrays({target, getDashArray}) {
    return this._updateAttribute({target, size: 2, getValue: getDashArray});
  }

  colors({target, getColor}) {
    return this._updateAttribute({
      target,
      size: 4,
      getValue: object => {
        const color = getColor(object);
        if (isNaN(color[3])) {
          color[3] = 255;
        }
        return color;
      }
    });
  }

  pickingColors({target, getPickingColor}) {
    return this._updateAttribute({
      target,
      size: 3,
      getValue: (object, index) => getPickingColor(index)
    });
  }

  /* Utilities */
  getPathLength(path) {
    return path.length;
  }

  getPointOnPath(path, index) {
    return path[index];
  }

  countInstancesInGeometry(path) {
    return Math.max(0, this.getPathLength(path) - 1);
  }

  isClosed(path) {
    const numPoints = this.getPathLength(path);
    const firstPoint = this.getPointOnPath(path, 0);
    const lastPoint = this.getPointOnPath(path, numPoints - 1);
    return (
      firstPoint[0] === lastPoint[0] &&
      firstPoint[1] === lastPoint[1] &&
      firstPoint[2] === lastPoint[2]
    );
  }

  /* Updaters */
  /* eslint-disable max-statements, complexity */
  updateGeometryAttributes() {
    const {
      attributes: {startPositions, endPositions, leftDeltas, rightDeltas, startEndPositions64XyLow},
      fp64
    } = this;

    let i = 0;
    this._forEachGeometry(path => {
      const numPoints = this.getPathLength(path);

      if (numPoints < 2) {
        // ignore invalid path
        return;
      }
      const isPathClosed = this.isClosed(path);

      let startPoint = this.getPointOnPath(path, 0);
      let endPoint = this.getPointOnPath(path, 1);
      let prevPoint = isPathClosed ? this.getPointOnPath(path, numPoints - 2) : startPoint;
      let nextPoint;

      for (let ptIndex = 1; ptIndex < numPoints; ptIndex++) {
        nextPoint = this.getPointOnPath(path, ptIndex + 1);
        if (!nextPoint) {
          nextPoint = isPathClosed ? this.getPointOnPath(path, 1) : endPoint;
        }

        startPositions[i * 3] = startPoint[0];
        startPositions[i * 3 + 1] = startPoint[1];
        startPositions[i * 3 + 2] = startPoint[2] || 0;

        endPositions[i * 3] = endPoint[0];
        endPositions[i * 3 + 1] = endPoint[1];
        endPositions[i * 3 + 2] = endPoint[2] || 0;

        leftDeltas[i * 3] = startPoint[0] - prevPoint[0];
        leftDeltas[i * 3 + 1] = startPoint[1] - prevPoint[1];
        leftDeltas[i * 3 + 2] = startPoint[2] - prevPoint[2] || 0;

        rightDeltas[i * 3] = nextPoint[0] - endPoint[0];
        rightDeltas[i * 3 + 1] = nextPoint[1] - endPoint[1];
        rightDeltas[i * 3 + 2] = nextPoint[2] - endPoint[2] || 0;

        if (fp64) {
          startEndPositions64XyLow[i * 4] = fp64LowPart(startPoint[0]);
          startEndPositions64XyLow[i * 4 + 1] = fp64LowPart(startPoint[1]);
          startEndPositions64XyLow[i * 4 + 2] = fp64LowPart(endPoint[0]);
          startEndPositions64XyLow[i * 4 + 3] = fp64LowPart(endPoint[1]);
        }

        prevPoint = startPoint;
        startPoint = endPoint;
        endPoint = nextPoint;

        i++;
      }
    });
  }
  /* eslint-enable max-statements, complexity */
}
