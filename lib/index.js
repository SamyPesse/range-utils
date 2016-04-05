var extend = require('extend');
var is = require('is');

function Range(offset, length, props) {
    var range = {};

    extend(range, props);
    range.offset = offset || 0;
    range.length = length || 0;

    return range;
}

Range.is = function isRange(range) {
    return (range && is.number(range.offset) && is.number(range.length));
}

// Return end position
Range.end = function end(range) {
    return (range.offset + range.length);
};

// Return true if an offset/range is in the range
Range.contains = function contains(range, offset) {
    if (Range.is(offset)) {
        return (
            Range.contains(range, offset.offset) &&
            Range.contains(range, Range.end(offset))
        );
    }

    return (offset >= range.offset && offset < (range.offset + range.length));
};

// Return true if range starts in b
Range.startsIn = function startsIn(a, b) {
    return (a.offset >= b.offset && a.offset < (b.offset + b.length));
};

// Return true if range is before a
Range.isBefore = function isBefore(a, b) {
    return (a.offset < b.offset);
};

// Return true if range is after a
Range.isAfter = function isAfter(a, b) {
    return (a.offset >= Range.end(b));
};

// Return true if both ranges have the same position
Range.areEquals = function areEquals(a, b) {
    return (a.offset === b.offset && a.length === b.length);
};

// Return true if range is collapsing with another range
Range.areCollapsing = function areCollapsing(a, b) {
    return ((Range.startsIn(a, b) || Range.startsIn(b, a)) && !Range.areEquals(a, b));
};

// Move this range to a new position, returns a new range
Range.move = function move(range, offset, length) {
    return Range(offset, length, range);
};

// Move a range from a specified index
Range.moveBy = function moveBy(range, index) {
    return Range(range.offset + index, range.length, range);
};

// Enlarge a range
Range.enlarge = function enlarge(range, index) {
    return Range(range.offset, range.length + index, range);
};

// Considering a list of applied ranges with special prop "value" (text after application)
// (offset,length are still relative to the current string)
// It moves a range to match the resulting text
Range.relativeTo = function relativeTo(start, ranges) {
    return ranges.reduce(function(current, range, i) {
        var change = range.value.length - range.length;

        // Enlarge if the current range contains the other one
        if (Range.contains(current, range)) {
            return Range.enlarge(current, change);
        }

        // Change if before the other modification, range is not affected
        if (Range.isBefore(current, range)) {
            return current;
        }

        // Change is after the last modification, move it by the difference in length
        if (Range.isAfter(current, range)) {
            return Range.moveBy(current, change);
        }

        if (current.offset == range.offset) {
            return Range.enlarge(current, change);
        }

        return current;
    }, start);
};

// Collapse two ranges and return a list of ranges
Range.collapse = function collapse(a, b) {
    var intersectionOffset = a.offset + (b.offset - a.offset);
    var intersectionLength = (a.offset + a.length - b.offset);

    return [
        Range.move(a, a.offset, b.offset - a.offset),
        Range.move(a, intersectionOffset, intersectionLength),
        Range.move(b, intersectionOffset, intersectionLength),
        Range.move(b, intersectionOffset + intersectionLength, b.offset + b. length - (intersectionOffset + intersectionLength))
    ];
};

// Ranges for draft are not always linear
// But markup languages require linear ranges
Range.linearize = function linearize(ranges) {
    var result = [], range, last, collapsed;

    // Sort according to offset
    ranges = Range.sort(ranges);

    for (var i = 0; i < ranges.length; i++) {
        range = ranges[i];
        last = result[result.length - 1];

        if (last && Range.areCollapsing(last, range)) {
            collapsed = Range.collapse(last, range);

            // Remove last one
            result.pop();

            // Push new ranges
            result = result.concat(collapsed);

        } else {
            result.push(range);
        }
    }

    return Range.compact(result);
};

// Merge ranges collpasing
Range.merge = function merge(ranges, fn) {
    var result = [], range, last;

    // Linearize ranges
    ranges = Range.linearize(ranges);

    for (var i = 0; i < ranges.length; i++) {
        range = ranges[i];
        last = result[result.length - 1];

        if (last && Range.areEquals(range, last)) {
            // Remove last one
            result.pop();

            // Push new ranges
            result.push(fn(range, last));
        } else {
            result.push(range);
        }
    }

    return Range.compact(result);
};

// Sort a list of ranges (using offset position)
Range.sort = function(ranges) {
    return [].concat(ranges).sort(function(a, b) {
        return a.offset - b.offset;
    });
};

// Sort a list of ranges by size
Range.sortByLength = function(ranges) {
    return [].concat(ranges).sort(function(a, b) {
        return a.length - b.length;
    });
};

// Fill empty spaces in a text with new ranges
// Ranges should be linearized
Range.fill = function(text, ranges, props) {
    var rangeStart = 0;
    var rangeLength = 0;
    var result = [];
    var range;

    function pushFilledRange() {
        if (!rangeLength) return;

        result.push(Range(rangeStart, rangeLength, props));
    }

    for (var i = 0; i < text.length; i++) {
        range = Range.findByOffset(ranges, i);

        if (range) {
            pushFilledRange();

            rangeStart = i + 1;
            rangeLength = 0;
        } else {
            rangeLength++;
        }
    }

    pushFilledRange();

    return Range.sort(result.concat(ranges));
};

// Find a range containing an offset
Range.findByOffset = function findByOffset(ranges, offset) {
    var result;

    for (var i = 0;i < ranges.length; i++) {
        if (Range.contains(ranges[i], offset)) {
            result = ranges[i];
            break;
        }
    }

    return result;
};

// Move a list of ranges
Range.moveRangesBy = function moveRanges(ranges, index) {
    return ranges.map(function(range) {
        return Range.moveBy(range, index);
    });
};

// Remove empty ranges
Range.compact = function compact(ranges) {
    var result = [];

    ranges.map(function(range) {
        if (range.length > 0) result.push(range);
    });

    return result;
};

// Apply a list of ranges/tranformations on the same text
Range.reduceText = function reduceText(originalText, groups, fn) {
    if (Range.is(groups[0])) groups = [groups];

    var appliedRanges = [];

    return groups.reduce(function(groupText, ranges) {
        // Linearize with entities
        ranges = Range.linearize(ranges);

        // Sort by size, we'll apply the shortest first
        ranges = Range.sortByLength(ranges);

        return ranges.reduce(function(text, currentRange) {
            var range = Range.relativeTo(currentRange, appliedRanges);

            // Extract text from range
            var originalText = text.slice(
                range.offset,
                range.offset + range.length
            );

            // Calcul new text
            var resultText = fn(originalText, range);

            // Push this range as being applied
            appliedRanges.push(
                Range(range.offset, range.length, {
                    value: resultText
                })
            );

            // Replace text
            return text.slice(0, range.offset) + resultText + text.slice(range.offset + range.length);
        }, groupText);
    }, originalText);
};


module.exports = Range;
