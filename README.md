# range-utils

Javascript utilities to work with ranges. A range is an object with a least two property: `offset` and `length`.

[![Build Status](https://travis-ci.org/SamyPesse/range-utils.png?branch=master)](https://travis-ci.org/SamyPesse/range-utils)
[![NPM version](https://badge.fury.io/js/range-utils.svg)](http://badge.fury.io/js/range-utils)


### Installation

```
$ npm install range-utils
```

### Usage

Ranges are standard JavaScript objects, but the `Range` constructor can be use to initialize a range:

```js
var from0To10 = Range(0, 10);
var from5To20 = Range(5, 15);
var withProperty = Range(0, 10, { hello: 'world' });
```

##### Collapsing Ranges

Test if two ranges are collapsing:

```js
if (Range.areCollapsing(a, b)) {
    ...
}
```

