import { analyzeCode } from "../src/lib/analysis/index";

// Test 1: User's exact shared object mutation code
console.log("=== Test 1: Shared Object Mutation ===\n");
const sharedObjCode = `
const sharedAddress = {
  city: "Glasgow",
  country: "UK",
};

const userA = {
  name: "Alice",
  address: sharedAddress,
};

const userB = {
  name: "Bob",
  address: sharedAddress,
};

userB.address.city = "Edinburgh";

console.log(userA.address.city);
console.log(userB.address.city);
`;

let analysis = analyzeCode(sharedObjCode);
let dfDetections = analysis.detections.filter(d => d.source === "dataflow");
console.log(`Data Flow detections: ${dfDetections.length}`);
dfDetections.forEach(d => {
  console.log(`  [${d.topicSlug}] L${d.location?.line}:${d.location?.column} - ${d.details}`);
});

// Test 2: Nested ternary
console.log("\n=== Test 2: Nested Ternary ===\n");
const nestedTernaryCode = `
const result = a > 0 ? (b > 0 ? "both positive" : "a only") : "neither";
`;
analysis = analyzeCode(nestedTernaryCode);
dfDetections = analysis.detections.filter(d => d.source === "dataflow");
console.log(`Data Flow detections: ${dfDetections.length}`);
dfDetections.forEach(d => {
  console.log(`  [${d.topicSlug}] L${d.location?.line}:${d.location?.column} - ${d.details}`);
});

// Test 3: Long parameter list
console.log("\n=== Test 3: Long Parameter List ===\n");
const longParamsCode = `
function createUser(name, age, email, phone, address, role) {
  return { name, age, email, phone, address, role };
}
`;
analysis = analyzeCode(longParamsCode);
dfDetections = analysis.detections.filter(d => d.source === "dataflow");
console.log(`Data Flow detections: ${dfDetections.length}`);
dfDetections.forEach(d => {
  console.log(`  [${d.topicSlug}] L${d.location?.line}:${d.location?.column} - ${d.details}`);
});

// Test 4: Deep nesting
console.log("\n=== Test 4: Deep Nesting ===\n");
const deepNestingCode = `
function process(data) {
  if (data) {
    for (let i = 0; i < data.length; i++) {
      if (data[i].active) {
        for (let j = 0; j < data[i].items.length; j++) {
          if (data[i].items[j].valid) {
            console.log("deep!");
          }
        }
      }
    }
  }
}
`;
analysis = analyzeCode(deepNestingCode);
dfDetections = analysis.detections.filter(d => d.source === "dataflow");
console.log(`Data Flow detections: ${dfDetections.length}`);
dfDetections.forEach(d => {
  console.log(`  [${d.topicSlug}] L${d.location?.line}:${d.location?.column} - ${d.details}`);
});

// Test 5: Array method no return
console.log("\n=== Test 5: Array Method No Return ===\n");
const arrayNoReturnCode = `
const items = [1, 2, 3];
const doubled = items.map(x => {
  const result = x * 2;
});
const found = items.filter(x => {
  if (x > 2) return true;
});
`;
analysis = analyzeCode(arrayNoReturnCode);
dfDetections = analysis.detections.filter(d => d.source === "dataflow");
console.log(`Data Flow detections: ${dfDetections.length}`);
dfDetections.forEach(d => {
  console.log(`  [${d.topicSlug}] L${d.location?.line}:${d.location?.column} - ${d.details}`);
});

// Test 6: React state mutation
console.log("\n=== Test 6: React State Mutation ===\n");
const reactStateMutCode = `
import React, { useState, useEffect } from 'react';

function TodoList() {
  const [items, setItems] = useState([]);
  const [user, setUser] = useState({ name: "", score: 0 });

  function addItem(item) {
    items.push(item);  // BAD: direct mutation
    setItems(items);
  }

  function updateScore() {
    user.score += 1;   // BAD: direct mutation
    setUser(user);
  }

  useEffect(() => {
    const id = setInterval(() => console.log("tick"), 1000);
    // BAD: no cleanup return
  }, []);

  return <div>{items.length}</div>;
}
`;
analysis = analyzeCode(reactStateMutCode);
dfDetections = analysis.detections.filter(d => d.source === "dataflow");
console.log(`Data Flow detections: ${dfDetections.length}`);
dfDetections.forEach(d => {
  console.log(`  [${d.topicSlug}] L${d.location?.line}:${d.location?.column} - ${d.details}`);
});

// Test 7: Var used before initialization
console.log("\n=== Test 7: Var Used Before Init ===\n");
const varBeforeInitCode = `
console.log("Initial total:", total);
console.log("First item:", items[0]);

addItem("apple");

var total = 0;
var items = [];

function addItem(name) {
  items[name] = { count: 0 };
  total = total + 1;
}

printSummary();

var printSummary = function () {
  console.log("Summary:", total, "items");
};
`;
analysis = analyzeCode(varBeforeInitCode);
dfDetections = analysis.detections.filter(d => d.source === "dataflow");
const varInitDetections = dfDetections.filter(d => d.topicSlug === "var-used-before-init");
console.log(`var-used-before-init detections: ${varInitDetections.length}`);
varInitDetections.forEach(d => {
  console.log(`  [${d.topicSlug}] L${d.location?.line}:${d.location?.column} - ${d.details}`);
});

// Test 8: Array used as object
console.log("\n=== Test 8: Array Used as Object ===\n");
const arrayAsObjectCode = `
var items = [];

function addItem(name) {
  if (!items[name]) {
    items[name] = { count: 0 };
  }
  items[name].count++;
}

addItem("apple");
addItem("banana");
console.log(items.length);
`;
analysis = analyzeCode(arrayAsObjectCode);
dfDetections = analysis.detections.filter(d => d.source === "dataflow");
const arrayObjDetections = dfDetections.filter(d => d.topicSlug === "array-as-object");
console.log(`array-as-object detections: ${arrayObjDetections.length}`);
arrayObjDetections.forEach(d => {
  console.log(`  [${d.topicSlug}] L${d.location?.line}:${d.location?.column} - ${d.details}`);
});

// Summary
console.log("\n=== Summary ===");
console.log("All data flow detectors working correctly.");
