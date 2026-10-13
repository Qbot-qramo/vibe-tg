function runTurtleTests(Turtle) {
    let testPassed = (testName) => {
        console.log(`%cTEST %cPASSED %cTurtle ${testName}`, 'color: black;', 'color: green; font-weight:bold;', 'color: grey;');
    };
    let testFailed = (testName) => {
        console.log(`%cTEST %cFAILED %cTurtle ${testName}`, 'color: black;', 'color: red; font-weight:bold;', 'color: grey;');
    };
    let createTurtle = () => {
        let canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        return new Turtle(canvas);
    };
    let assertColor = (testName = "", colorIndex = 0, expectedColorIndex = 0) => {
        let actual = createTurtle().getColor(colorIndex);
        let expected = Turtle.colors[expectedColorIndex].color;
        let success = actual === expected;
        if (success) {
            testPassed(testName);
        } else {
            testFailed(`${testName}: expected ${expected} but we get ${actual} instead`);
        }
        return success;
    };
    let assertDrawsWithPenColor = (testName = "", colorIndex = 0) => {
        let success = true;
        try {
            let turtle = createTurtle();
            turtle.execute_setpencolor(colorIndex);
            turtle.execute_forward(10);
            turtle.execute_label("A");
            turtle.execute_setbackground(colorIndex);
        } catch (error) {
            success = false;
            testFailed(`${testName}: ${error}`);
        }
        if (success) {
            testPassed(testName);
        }
        return success;
    };

    let lastColorIndex = Turtle.colors.length - 1;
    let tests = [];

    tests.push(assertColor("Color 0 is the first color", 0, 0));
    tests.push(assertColor(`Color ${lastColorIndex} is the last color`, lastColorIndex, lastColorIndex));
    tests.push(assertColor(`Color ${lastColorIndex + 1} falls back to black`, lastColorIndex + 1, 0));
    tests.push(assertColor("A negative color falls back to black", -1, 0));
    tests.push(assertColor("A fractional color is truncated", 3.5, 3));
    tests.push(assertColor("A color that is not a number falls back to black", NaN, 0));
    tests.push(assertDrawsWithPenColor(`Drawing with color ${lastColorIndex + 1} does not crash`, lastColorIndex + 1));
    tests.push(assertDrawsWithPenColor("Drawing with a fractional color does not crash", 7 / 2));

    return tests.every(test => test);
}
