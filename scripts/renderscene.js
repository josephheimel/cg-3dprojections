let view;
let ctx;
let scene;
let start_time;

const LEFT =   32; // binary 100000
const RIGHT =  16; // binary 010000
const BOTTOM = 8;  // binary 001000
const TOP =    4;  // binary 000100
const FAR =    2;  // binary 000010
const NEAR =   1;  // binary 000001
const FLOAT_EPSILON = 0.000001;

// Initialization function - called when web page loads
function init() {
    let w = 800;
    let h = 600;
    view = document.getElementById('view');
    view.width = w;
    view.height = h;

    ctx = view.getContext('2d');

    // initial scene... feel free to change this
    scene = {
        view: {
            type: 'perspective',
            prp: Vector3(44, 20, -16),
            srp: Vector3(20, 20, -40),
            vup: Vector3(0, 1, 0),
            clip: [-19, 5, -10, 8, 12, 100]
        },
        models: [
            {
                type: 'generic',
                vertices: [
                    Vector4( 0,  0, -30, 1),
                    Vector4(20,  0, -30, 1),
                    Vector4(20, 12, -30, 1),
                    Vector4(10, 20, -30, 1),
                    Vector4( 0, 12, -30, 1),
                    Vector4( 0,  0, -60, 1),
                    Vector4(20,  0, -60, 1),
                    Vector4(20, 12, -60, 1),
                    Vector4(10, 20, -60, 1),
                    Vector4( 0, 12, -60, 1)
                ],
                edges: [
                    [0, 1, 2, 3, 4, 0],
                    [5, 6, 7, 8, 9, 5],
                    [0, 5],
                    [1, 6],
                    [2, 7],
                    [3, 8],
                    [4, 9]
                ],
                matrix: new Matrix(4, 4)
            }
        ]
    };

    // event handler for pressing arrow keys
    document.addEventListener('keydown', onKeyDown, false);
    
    // start animation loop
    start_time = performance.now(); // current timestamp in milliseconds
    window.requestAnimationFrame(animate);
}

// Animation loop - repeatedly calls rendering code
function animate(timestamp) {

    // Clears Previously drawn frame
    ctx.clearRect(0, 0, view.width, view.height);

    // step 1: calculate time (time since start)
    let time = timestamp - start_time;
    
    // step 2: transform models based on time
    //console.log(theta);
    scene.models.forEach(model => {
        if (model.animation!=null){
            let theta = time*2*Math.PI*model.animation.rps/1000; //model.animation.rps * 2 * Math.PI * time; //Degrees in radians the model must be transformed from original position at current time
            if (model.animation.axis === 'x'){
                Mat4x4RotateX(model.matrix, theta);
            } else if (model.animation.axis === 'y'){
                Mat4x4RotateY(model.matrix, theta);
            } else if (model.animation.axis === 'z'){
                Mat4x4RotateZ(model.matrix, theta);
            }
            if (model.animation.axis!=null & model.animation.center === 'y'){
                let negativePRPTranslateMatrix = new Matrix(4, 4);
                Mat4x4Translate(negativePRPTranslateMatrix, -model.center.x, -model.center.y, -model.center.z);
                let positivePRPTranslateMatrix = new Matrix(4, 4);
                Mat4x4Translate(positivePRPTranslateMatrix, model.center.x, model.center.y, model.center.z);
                model.matrix = Matrix.multiply([positivePRPTranslateMatrix, model.matrix, negativePRPTranslateMatrix]);
            }
        }
    });

    // step 3: draw scene
    drawScene();

    // step 4: request next animation frame (recursively calling same function)
    // (may want to leave commented out while debugging initially)

    window.requestAnimationFrame(animate);
}

// Main drawing code - use information contained in variable `scene`
function drawScene() {
    //console.log(scene);
    
    let transformMatrix;
    let projectionMatrix;
    let windowMatrix = new Matrix(4, 4);
    windowMatrix.values = [[view.width/2, 0, 0, view.width/2],
                  [0, view.height/2, 0, view.height/2],
                  [0, 0, 1, 0],
                  [0, 0, 0, 1]];

    if(scene.view.type == 'perspective') {
        transformMatrix = mat4x4Perspective(scene.view.prp, scene.view.srp, scene.view.vup, scene.view.clip);
        projectionMatrix = mat4x4MPer();
    } else {
        transformMatrix = mat4x4Parallel(scene.view.prp, scene.view.srp, scene.view.vup, scene.view.clip);
        projectionMatrix = mat4x4MPar();
    }
    
    
    // For each model, for each edge
    scene.models.forEach(model => {

        //  * transform to canonical view volume
        let transformedVertices = []; //Holds the new transformed vertices of the model
        model.vertices.forEach(vertexPoint => {
            newVertex = Matrix.multiply([transformMatrix,model.matrix,vertexPoint]);
            newVertex.x = newVertex.x/newVertex.w;
            newVertex.y = newVertex.y/newVertex.w;
            transformedVertices.push(newVertex);
        });


        /**
         * Edges property is such that each element of the array has its own array (child)
         * The numbers of the child array correspond to which elements of the vertex array should be connected in order
         * ie edges[0] == [a,b,c,a], so connect vertex a to b, b to c, and c to a
         */
         model.edges.forEach(edgeList => {
            for(let i = 0; i < edgeList.length-1; i++) {

                let pointZero = transformedVertices[edgeList[i]];
                let pointOne = transformedVertices[edgeList[i+1]];

                let line = {
                    pt0: Vector4(pointZero.x, pointZero.y, pointZero.z, 1),
                    pt1: Vector4(pointOne.x, pointOne.y, pointOne.z, 1)
                }

                //  * clip in 3D
                if(scene.view.type == 'perspective') {
                    line = clipLinePerspective(line, -1*(scene.view.clip[4]/scene.view.clip[5]));
                } else {
                    line = clipLineParallel(line);
                }


                if(line == null) {continue;} // Skips current iteration of loop if there is no line to draw


                //  * project to 2D
                newVertex = Matrix.multiply([windowMatrix, projectionMatrix, line.pt0]);
                newVertex.x = newVertex.x/newVertex.w;
                newVertex.y = newVertex.y/newVertex.w;
                newVertex1 = Matrix.multiply([windowMatrix, projectionMatrix, line.pt1]);
                newVertex1.x = newVertex1.x/newVertex1.w;
                newVertex1.y = newVertex1.y/newVertex1.w;

                //  * draw line
                drawLine(newVertex.x, newVertex.y, newVertex1.x, newVertex1.y);

            }
        });
    });
    
}


// Get outcode for vertex (parallel view volume)
function outcodeParallel(vertex) {
    let outcode = 0;
    if (vertex.x < (-1.0 - FLOAT_EPSILON)) {
        outcode += LEFT;
    }
    else if (vertex.x > (1.0 + FLOAT_EPSILON)) {
        outcode += RIGHT;
    }
    if (vertex.y < (-1.0 - FLOAT_EPSILON)) {
        outcode += BOTTOM;
    }
    else if (vertex.y > (1.0 + FLOAT_EPSILON)) {
        outcode += TOP;
    }
    if (vertex.z < (-1.0 - FLOAT_EPSILON)) {
        outcode += FAR;
    }
    else if (vertex.z > (0.0 + FLOAT_EPSILON)) {
        outcode += NEAR;
    }
    return outcode;
}

// Get outcode for vertex (perspective view volume)
function outcodePerspective(vertex, z_min) {
    let outcode = 0;
    if (vertex.x < (vertex.z - FLOAT_EPSILON)) {
        outcode += LEFT;
    }
    else if (vertex.x > (-vertex.z + FLOAT_EPSILON)) {
        outcode += RIGHT;
    }
    if (vertex.y < (vertex.z - FLOAT_EPSILON)) {
        outcode += BOTTOM;
    }
    else if (vertex.y > (-vertex.z + FLOAT_EPSILON)) {
        outcode += TOP;
    }
    if (vertex.z < (-1.0 - FLOAT_EPSILON)) {
        outcode += FAR;
    }
    else if (vertex.z > (z_min + FLOAT_EPSILON)) {
        outcode += NEAR;
    }
    return outcode;
}

// Clip line - should either return a new line (with two endpoints inside view volume) or null (if line is completely outside view volume)
function clipLineParallel(line) {

    let result = {
        pt0: Vector4(line.pt0.x, line.pt0.y, line.pt0.z, 1),
        pt1: Vector4(line.pt1.x, line.pt1.y, line.pt1.z, 1)
    };

    let p0 = Vector3(line.pt0.x, line.pt0.y, line.pt0.z); 
    let p1 = Vector3(line.pt1.x, line.pt1.y, line.pt1.z);
    let out0 = outcodeParallel(p0);
    let out1 = outcodeParallel(p1);

    let trivialReject = out0 & out1;
    let trivialAccept = out0 | out1;


    while(trivialAccept != 0) {

        // Recalculate
        p0 = Vector3(result.pt0.x, result.pt0.y, result.pt0.z); 
        p1 = Vector3(result.pt1.x, result.pt1.y, result.pt1.z);
        out0 = outcodeParallel(p0);
        out1 = outcodeParallel(p1);
        trivialReject = out0 & out1;
        trivialAccept = out0 | out1;

        if(trivialReject != 0) { // Trivial Rejection, both points are outside same edge, line is clipped, return null
            return null;
        }

        // Vars
        let xDelta = p1.x - p0.x;
        let yDelta = p1.y - p0.y;
        let zDelta = p1.z - p0.z;

        let outcode;
        let point;

        if(out0 != 0) {
            outcode = out0;
            point = {x: p0.x, y: p0.y, z: p0.z};
        } else {
            outcode = out1;
            point = {x: p1.x, y: p1.y, z: p1.z};
        }

        point = findNewEndpointParallel(p0.x, p1.x, xDelta, p0.y, p1.y, yDelta, p0.z, p1.z, zDelta, outcode, point);


        // Modify return value
        if(out0 != 0) {
            result.pt0.x = point.x;
            result.pt0.y = point.y;
            result.pt0.z = point.z;
        } else {
            result.pt1.x = point.x;
            result.pt1.y = point.y;
            result.pt1.z = point.z;
        }
    }
    return result
}

// Clip line - should either return a new line (with two endpoints inside view volume) or null (if line is completely outside view volume)
function clipLinePerspective(line, z_min) {

    let result = {
        pt0: Vector4(line.pt0.x, line.pt0.y, line.pt0.z, 1),
        pt1: Vector4(line.pt1.x, line.pt1.y, line.pt1.z, 1)
    };

    let p0 = Vector3(line.pt0.x, line.pt0.y, line.pt0.z); 
    let p1 = Vector3(line.pt1.x, line.pt1.y, line.pt1.z);
    let out0 = outcodePerspective(p0, z_min);
    let out1 = outcodePerspective(p1, z_min);

    let trivialReject = out0 & out1;
    let trivialAccept = out0 | out1;


    while(trivialAccept != 0) {

        // Recalculate
        p0 = Vector3(result.pt0.x, result.pt0.y, result.pt0.z); 
        p1 = Vector3(result.pt1.x, result.pt1.y, result.pt1.z);
        out0 = outcodePerspective(p0, z_min);
        out1 = outcodePerspective(p1, z_min);
        trivialReject = out0 & out1;
        trivialAccept = out0 | out1;

        if(trivialReject != 0) { // Trivial Rejection, both points are outside same edge, line is clipped, return null
            return null;
        }

        // Vars
        let xDelta = p1.x - p0.x;
        let yDelta = p1.y - p0.y;
        let zDelta = p1.z - p0.z;

        let outcode;
        let point;

        if(out0 != 0) {
            outcode = out0;
            point = {x: p0.x, y: p0.y, z: p0.z};
        } else {
            outcode = out1;
            point = {x: p1.x, y: p1.y, z: p1.z};
        }

        point = findNewEndpointPerspective(p0.x, p1.x, xDelta, p0.y, p1.y, yDelta, p0.z, p1.z, zDelta, z_min, outcode, point);


        // Modify return value
        if(out0 != 0) {
            result.pt0.x = point.x;
            result.pt0.y = point.y;
            result.pt0.z = point.z;
        } else {
            result.pt1.x = point.x;
            result.pt1.y = point.y;
            result.pt1.z = point.z;
        }
    }
    return result
}

/**
 * The parametric equation for finding points on a line
 */
function parametricEquation(t, var0, var1) {    
    return ((1 - t) * var0) + (t * var1);
}

/**
 * 
 * this accounts for all of the possible alterations needed for perspective line clipping
 */
 function findNewEndpointParallel(x0, x1, xDelta, y0, y1, yDelta, z0, z1, zDelta, outcode, point) {

    let t; // shorthand only, value changes regularly

    // bitwise comparisons need to be set beforehand for some reason
    bitwiseWithLeft = outcode & LEFT;
    bitwiseWithRight = outcode & RIGHT;
    bitwiseWithBottom = outcode & BOTTOM;
    bitwiseWithTop = outcode & TOP;
    bitwiseWithFar = outcode & FAR;
    bitwiseWithNear = outcode & NEAR;


    if(bitwiseWithLeft == LEFT) { // Clip against the left plane
        //console.log('left');
        t = (-1 - x0) / xDelta;
        point.x = parametricEquation(t,x0,x1);
        point.y = parametricEquation(t,y0,y1);
        point.z = parametricEquation(t,z0,z1);
    } else if(bitwiseWithRight == RIGHT) { // Clip against the right plane
        //console.log('right');
        t = (1 - x0) / xDelta;
        point.x = parametricEquation(t,x0,x1);
        point.y = parametricEquation(t,y0,y1);
        point.z = parametricEquation(t,z0,z1);
    } else if(bitwiseWithBottom == BOTTOM) { // Clip against the bottom plane
        //console.log('bottom');
        t = (-1 - y0) / yDelta;
        point.x = parametricEquation(t,x0,x1);
        point.y = parametricEquation(t,y0,y1);
        point.z = parametricEquation(t,z0,z1);
    } else if(bitwiseWithTop == TOP) { // Clip against the top plane
        //console.log('top');
        t = (1 - y0) / yDelta;
        point.x = parametricEquation(t,x0,x1);
        point.y = parametricEquation(t,y0,y1);
        point.z = parametricEquation(t,z0,z1);
    } else if(bitwiseWithFar == FAR) { // Clip against the far plane
        //console.log('far');
        t = (-z0 - 1) / zDelta;
        point.x = parametricEquation(t,x0,x1);
        point.y = parametricEquation(t,y0,y1);
        point.z = parametricEquation(t,z0,z1);
    } else if(bitwiseWithNear == NEAR) { // Clip against the near plane
        //console.log('near');
        t = -z0 / zDelta;
        point.x = parametricEquation(t,x0,x1);
        point.y = parametricEquation(t,y0,y1);
        point.z = parametricEquation(t,z0,z1);
    }
    return point;
}

/**
 * 
 * this accounts for all of the possible alterations needed for perspective line clipping
 */
function findNewEndpointPerspective(x0, x1, xDelta, y0, y1, yDelta, z0, z1, zDelta, z_min, outcode, point) {

    let t; // shorthand only, value changes regularly

    // bitwise comparisons need to be set beforehand for some reason
    bitwiseWithLeft = outcode & LEFT;
    bitwiseWithRight = outcode & RIGHT;
    bitwiseWithBottom = outcode & BOTTOM;
    bitwiseWithTop = outcode & TOP;
    bitwiseWithFar = outcode & FAR;
    bitwiseWithNear = outcode & NEAR;


    if(bitwiseWithLeft == LEFT) { // Clip against the left plane
        t = ((-1 * x0) + z0) / (xDelta - zDelta);
        point.x = parametricEquation(t,x0,x1);
        point.y = parametricEquation(t,y0,y1);
        point.z = parametricEquation(t,z0,z1);
    } else if(bitwiseWithRight == RIGHT) { // Clip against the right plane
        t = (x0 + z0) / (-xDelta - zDelta);
        point.x = parametricEquation(t,x0,x1);
        point.y = parametricEquation(t,y0,y1);
        point.z = parametricEquation(t,z0,z1);
    } else if(bitwiseWithBottom == BOTTOM) { // Clip against the bottom plane
        t = (-y0 + z0) / (yDelta - zDelta);
        point.x = parametricEquation(t,x0,x1);
        point.y = parametricEquation(t,y0,y1);
        point.z = parametricEquation(t,z0,z1);
    } else if(bitwiseWithTop == TOP) { // Clip against the top plane
        t = (y0 + z0) / (-yDelta - zDelta);
        point.x = parametricEquation(t,x0,x1);
        point.y = parametricEquation(t,y0,y1);
        point.z = parametricEquation(t,z0,z1);
    } else if(bitwiseWithFar == FAR) { // Clip against the far plane
        t = (-z0 - 1) / zDelta;
        point.x = parametricEquation(t,x0,x1);
        point.y = parametricEquation(t,y0,y1);
        point.z = parametricEquation(t,z0,z1);
    } else if(bitwiseWithNear == NEAR) { // Clip against the near plane
        t = (z0 - z_min) / -zDelta;
        point.x = parametricEquation(t,x0,x1);
        point.y = parametricEquation(t,y0,y1);
        point.z = parametricEquation(t,z0,z1);
    }
    return point;
}


// Called when user presses a key on the keyboard down 
function onKeyDown(event) {

    let nUnit = scene.view.prp.subtract(scene.view.srp);
    nUnit.normalize();

    let uUnit = scene.view.vup.cross(nUnit);
    uUnit.normalize();

    let vUnit = nUnit.cross(uUnit);
    let theta = Math.PI/16;
    let rotationMatrix = new Matrix(3,3);

    switch (event.keyCode) {
        case 37: // LEFT Arrow
            console.log("left");

            rotationMatrix.values = [[Math.cos(theta)+Math.pow(vUnit.x,2)*(1-Math.cos(theta)), vUnit.x*vUnit.y*(1-Math.cos(theta))-vUnit.z*Math.sin(theta), vUnit.x*vUnit.z*(1-Math.cos(theta))+vUnit.y*Math.sin(theta)],
                                    [vUnit.y*vUnit.x*(1-Math.cos(theta))+vUnit.z*Math.sin(theta), Math.cos(theta)+Math.pow(vUnit.y,2)*(1-Math.cos(theta)), vUnit.y*vUnit.z*(1-Math.cos(theta))-vUnit.x*Math.sin(theta)],
                                    [vUnit.z*vUnit.x*(1-Math.cos(theta))-vUnit.y*Math.sin(theta), vUnit.z*vUnit.y*(1-Math.cos(theta))+vUnit.x*Math.sin(theta), Math.cos(theta)+Math.pow(vUnit.z,2)*(1-Math.cos(theta))]];
            
            //scene.view.prp = Matrix.multiply([rotationMatrix, scene.view.prp]);
            scene.view.srp = scene.view.srp.subtract(scene.view.prp);
            scene.view.srp = Matrix.multiply([rotationMatrix, scene.view.srp]);
            scene.view.srp = scene.view.srp.add(scene.view.prp);

            break;
        case 39: // RIGHT Arrow
            console.log("right");

            theta = -theta;
            rotationMatrix.values = [[Math.cos(theta)+Math.pow(vUnit.x,2)*(1-Math.cos(theta)), vUnit.x*vUnit.y*(1-Math.cos(theta))-vUnit.z*Math.sin(theta), vUnit.x*vUnit.z*(1-Math.cos(theta))+vUnit.y*Math.sin(theta)],
                                    [vUnit.y*vUnit.x*(1-Math.cos(theta))+vUnit.z*Math.sin(theta), Math.cos(theta)+Math.pow(vUnit.y,2)*(1-Math.cos(theta)), vUnit.y*vUnit.z*(1-Math.cos(theta))-vUnit.x*Math.sin(theta)],
                                    [vUnit.z*vUnit.x*(1-Math.cos(theta))-vUnit.y*Math.sin(theta), vUnit.z*vUnit.y*(1-Math.cos(theta))+vUnit.x*Math.sin(theta), Math.cos(theta)+Math.pow(vUnit.z,2)*(1-Math.cos(theta))]];
            
            //scene.view.prp = Matrix.multiply([rotationMatrix, scene.view.prp]);
            scene.view.srp = scene.view.srp.subtract(scene.view.prp);
            scene.view.srp = Matrix.multiply([rotationMatrix, scene.view.srp]);
            scene.view.srp = scene.view.srp.add(scene.view.prp);

            break;
        case 65: // A key
            scene.view.prp = scene.view.prp.subtract(uUnit);
            scene.view.srp = scene.view.srp.subtract(uUnit);
            break;
        case 68: // D key
            scene.view.prp = scene.view.prp.add(uUnit);
            scene.view.srp = scene.view.srp.add(uUnit);
            break;
        case 83: // S key
            scene.view.prp = scene.view.prp.add(nUnit);
            scene.view.srp = scene.view.srp.add(nUnit);
            break;
        case 87: // W key            
            scene.view.prp = scene.view.prp.subtract(nUnit);
            scene.view.srp = scene.view.srp.subtract(nUnit);
            break;
    }
}

/**
 * Generates vertices and edges for non-generic model types
 */
function generateGenericModels() {
    console.log(scene);
    for (let j = 0; j < scene.models.length; j++) {
        console.log("generic models loop");
        console.log(j);
        console.log(scene.models.length);
        console.log(scene.models[j].type);
        if (scene.models[j].type === 'cube') {
            let vertices = [];
            let edges = [];
            for (let i = 0; i < 8; i++) { //Make 8 points at cube's center
                vertices[i] = Vector4(scene.models[j].center.x, scene.models[j].center.y, scene.models[j].center.z, 1);
            }
            for (i = 0; i < 4; i++) { //Lower first 4 points to bottom y of cube
                vertices[i] = vertices[i].subtract(Vector4(0, scene.models[j].height / 2, 0, 0));
            }
            for (i = 4; i < 8; i++) { //Raise last 4 points to top y of cube
                vertices[i] = vertices[i].add(Vector4(0, scene.models[j].height / 2, 0, 0));
            }
            let pointlist = [0, 1, 4, 5];
            for (i = 0; i < 4; i++) { //Shift left 4 points to left x of cube
                vertices[pointlist[i]] = vertices[pointlist[i]].subtract(Vector4(scene.models[j].width / 2, 0, 0, 0));
            }
            pointlist = [2, 3, 6, 7];
            for (i = 0; i < 4; i++) { //Shift left 4 points to left x of cube
                vertices[pointlist[i]] = vertices[pointlist[i]].add(Vector4(scene.models[j].width / 2, 0, 0, 0));
            }
            pointlist = [0, 3, 4, 7];
            for (i = 0; i < 4; i++) { //Shift front 4 points to front z of cube
                vertices[pointlist[i]] = vertices[pointlist[i]].subtract(Vector4(0, 0, scene.models[j].depth / 2, 0));
            }
            pointlist = [1, 2, 5, 6];
            for (i = 0; i < 4; i++) { //Shift rear 4 points to rear z of cube
                vertices[pointlist[i]] = vertices[pointlist[i]].add(Vector4(0, 0, scene.models[j].depth / 2, 0));
            }
            edges[0] = [0, 1, 2, 3, 0];
            edges[1] = [4, 5, 6, 7, 4];
            for (i = 0; i < 4; i++) {
                edges[i + 2] = [edges[0][i], edges[1][i]];
            }
            console.log(vertices);
            console.log(edges);
            scene.models[j].vertices = vertices;
            scene.models[j].edges = edges;
            console.log("inside cube");
            console.log(scene.models[j]);
        } else if (scene.models[j].type === 'cylinder'){
            let vertices = [];
            let edges = [];
            edges[0]=[0, 0];
            edges[1]=[0, 0];
            let theta = 0;
            let increment = 2*Math.PI/scene.models[j].sides;
            let thispoint = {x:scene.models[j].center.x+scene.models[j].radius, z:scene.models[j].center.z};
            let nextpoint = {x:0,z:0};
            for (let i=0; i<scene.models[j].sides; i++){
                theta = theta + increment;
                nextpoint.x=scene.models[j].center.x+scene.models[j].radius*Math.cos(theta);
                nextpoint.z=scene.models[j].center.z+scene.models[j].radius*Math.sin(theta);
                thispoint = {x:nextpoint.x, z:nextpoint.z};
                vertices[i] = Vector4(thispoint.x, scene.models[j].center.y-(scene.models[j].height/2), thispoint.z, 1);
                vertices[i+scene.models[j].sides] = Vector4(thispoint.x, scene.models[j].center.y+(scene.models[j].height/2), thispoint.z, 1);
                edges[0][i]=i;
                edges[1][i]=scene.models[j].sides+i;
                edges[i + 2] = [edges[0][i], edges[1][i]];
            }
            edges[0][scene.models[j].sides]=0;
            edges[1][scene.models[j].sides]=scene.models[j].sides
            console.log(vertices);
            console.log(edges);
            scene.models[j].vertices = vertices;
            scene.models[j].edges = edges;
            console.log("inside cylinder");
            console.log(scene.models[j]);
        } else if (scene.models[j].type === 'cone'){
            let vertices = [];
            let edges = [];
            edges[0]=[0, 0];
            let theta = 0;
            let increment = 2*Math.PI/scene.models[j].sides;
            let thispoint = {x:scene.models[j].center.x+scene.models[j].radius, z:scene.models[j].center.z};
            let nextpoint = {x:0,z:0};
            for (let i=0; i<scene.models[j].sides; i++){
                theta = theta + increment;
                nextpoint.x=scene.models[j].center.x+scene.models[j].radius*Math.cos(theta);
                nextpoint.z=scene.models[j].center.z+scene.models[j].radius*Math.sin(theta);
                thispoint = {x:nextpoint.x, z:nextpoint.z};
                vertices[i] = Vector4(thispoint.x, scene.models[j].center.y, thispoint.z, 1);
                edges[0][i]=i;
                edges[i + 1] = [edges[0][i], scene.models[j].sides];
            }
            vertices[scene.models[j].sides] = Vector4(scene.models[j].center.x, scene.models[j].center.y+scene.models[j].height, scene.models[j].center.z, 1)
            edges[0][scene.models[j].sides]=0;
            console.log(vertices);
            console.log(edges);
            scene.models[j].vertices = vertices;
            scene.models[j].edges = edges;
            console.log("inside cone");
            console.log(scene.models[j]);
        } else if (scene.models[j].type === 'sphere'){
            let vertices = [];
            let edges = [];
            let theta = Math.PI/2;
            let increment = Math.PI/scene.models[j].stacks;
            let sliceTheta = 0;
            let sliceIncrement = 2*Math.PI/scene.models[j].slices;
            let rotationMatrix = new Matrix(4,4);
            let thispoint = Vector4(scene.models[j].center.x, scene.models[j].center.y-scene.models[j].radius, scene.models[j].center.z, 1); //Point at bottom of sphere
            for (let i = 0; i < scene.models[j].stacks+1; i++) {
                thispoint.x = scene.models[j].center.x + scene.models[j].radius * Math.cos(theta);
                thispoint.y = scene.models[j].center.y + scene.models[j].radius * Math.sin(theta);
                sliceTheta=0;
                for (let k=0; k<scene.models[j].slices; k++){
                    edges[k]=[0, 0];
                    Mat4x4RotateY(rotationMatrix, sliceTheta);
                    vertices[(k) * (scene.models[j].stacks + 1) + i] = scene.models[j].center.add(Matrix.multiply([rotationMatrix, Vector4(thispoint.x, thispoint.y, thispoint.z, 1).subtract(scene.models[j].center)]));
                    sliceTheta = sliceTheta + sliceIncrement;
                }
                theta = theta + increment;
            }
            for (k=0; k<scene.models[j].slices; k++){
                for (i = 0; i < scene.models[j].stacks+1; i++) {
                    edges[k][i] = (k) * (scene.models[j].stacks+1) + i;
                }
            }
            for (k=0; k<scene.models[j].stacks; k++){
                edges[k+scene.models[j].slices] = [0, 0];
                for (i = 0; i < scene.models[j].slices; i++) {
                    edges[k+scene.models[j].slices][i] = edges[i][k];
                }
                edges[k+scene.models[j].slices][scene.models[j].slices] = edges[k+scene.models[j].slices][0]
            }
            
            console.log(vertices);
            console.log(edges);
            scene.models[j].vertices = vertices;
            scene.models[j].edges = edges;
            console.log("inside sphere");
            console.log(scene.models[j]);
        } else if (scene.models[j].type === 'spiral'){
            let vertices = [];
            let edges = [];
            edges[0]=[0, 0];
            let theta = 0;
            let increment = Math.PI/scene.models[j].stacks;
            let sliceTheta = 0;
            let sliceIncrement = 2*Math.PI/scene.models[j].slices;
            let rotationMatrix = new Matrix(4,4);
            let thispoint = Vector4(scene.models[j].center.x, scene.models[j].center.y-scene.models[j].radius, scene.models[j].center.z, 1); //Point at bottom of sphere
            for (let i = 0; i < scene.models[j].stacks * 2; i++) {
                theta = theta + increment;
                thispoint.x = scene.models[j].center.x + scene.models[j].radius * Math.cos(theta);
                thispoint.y = scene.models[j].center.z + scene.models[j].radius * Math.sin(theta);
                for (let k=0; k<1; k++){
                    Mat4x4RotateY(rotationMatrix, sliceTheta);
                    vertices[(k) * scene.models[j].slices + i] = Matrix.multiply([rotationMatrix, Vector4(thispoint.x, thispoint.y, thispoint.z, 1)]);
                    edges[k][i] = (k) * scene.models[j].slices + i;
                    sliceTheta = sliceTheta + sliceIncrement;
                    edges[k][scene.models[j].stacks * 2] = (k) * scene.models[j].slices;
                }
            }
            
            console.log(vertices);
            console.log(edges);
            scene.models[j].vertices = vertices;
            scene.models[j].edges = edges;
            console.log("inside spiral");
            console.log(scene.models[j]);
        } else if (scene.models[j].type === 'sploob'){
            let vertices = [];
            let edges = [];
            let theta = 0;
            let thetaIncrement = 2*Math.PI/scene.models[j].slices;
            let phi = 0;
            let phiIncrement = Math.PI/scene.models[j].stacks;
            vertices[0] = scene.models[j].center.add(Vector4(scene.models[j].radius*Math.cos(theta)*Math.cos(phi), scene.models[j].radius*Math.cos(phi), scene.models[j].radius*Math.sin(theta)*Math.sin(phi), 0));
            for (let k=1; k<scene.models[j].stacks; k++){
                edges[k-1]=[0, 0];
                phi = phi+phiIncrement;
                for (let i=0; i<scene.models[j].slices; i++){
                    theta = theta+thetaIncrement;
                    vertices[(k-1)*scene.models[j].slices+i+1] = scene.models[j].center.add(Vector4(scene.models[j].radius*Math.cos(theta)*Math.cos(phi), scene.models[j].radius*Math.cos(phi), scene.models[j].radius*Math.sin(theta)*Math.sin(phi), 0));
                    edges[k-1][i]=(k-1)*scene.models[j].slices+i+1;
                }
                edges[k-1][scene.models[j].slices] = (k-1)*scene.models[j].slices+1;
            }
            phi = phi+phiIncrement;
            vertices[vertices.length] = scene.models[j].center.add(Vector4(scene.models[j].radius*Math.cos(theta)*Math.cos(phi), scene.models[j].radius*Math.cos(phi), scene.models[j].radius*Math.sin(theta)*Math.sin(phi), 0));
            for (i=0; i<scene.models[j].stacks; i++){
                edges[scene.models[j].stacks+i]=[0, 0];
                edges[scene.models[j].stacks+i][i+1]
            }
            console.log(vertices);
            console.log(edges);
            scene.models[j].vertices = vertices;
            scene.models[j].edges = edges;
            console.log("inside sploob");
            console.log(scene.models[j]);
        }
    }
}

///////////////////////////////////////////////////////////////////////////
// No need to edit functions beyond this point
///////////////////////////////////////////////////////////////////////////

// Called when user selects a new scene JSON file
function loadNewScene() {
    let scene_file = document.getElementById('scene_file');

    console.log(scene_file.files[0]);

    let reader = new FileReader();
    reader.onload = (event) => {
        scene = JSON.parse(event.target.result);
        scene.view.prp = Vector3(scene.view.prp[0], scene.view.prp[1], scene.view.prp[2]);
        scene.view.srp = Vector3(scene.view.srp[0], scene.view.srp[1], scene.view.srp[2]);
        scene.view.vup = Vector3(scene.view.vup[0], scene.view.vup[1], scene.view.vup[2]);

        for (let i = 0; i < scene.models.length; i++) {
            console.log("loadscene");
            console.log(scene.models.length);
            if (scene.models[i].type === 'generic') {
                for (let j = 0; j < scene.models[i].vertices.length; j++) {
                    scene.models[i].vertices[j] = Vector4(scene.models[i].vertices[j][0],
                                                          scene.models[i].vertices[j][1],
                                                          scene.models[i].vertices[j][2],
                                                          1);
                }
            }
            else {
                scene.models[i].center = Vector4(scene.models[i].center[0],
                                                 scene.models[i].center[1],
                                                 scene.models[i].center[2],
                                                 1);
            }
            scene.models[i].matrix = new Matrix(4, 4);
        }
        generateGenericModels();
        //window.requestAnimationFrame(animate);
    };
    reader.readAsText(scene_file.files[0], 'UTF-8');
}

// Draw black 2D line with red endpoints 
function drawLine(x1, y1, x2, y2) {

    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.fillStyle = '#FF0000';
    ctx.fillRect(x1 - 2, y1 - 2, 4, 4);
    ctx.fillRect(x2 - 2, y2 - 2, 4, 4);
}
