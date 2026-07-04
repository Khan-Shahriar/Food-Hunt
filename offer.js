const API="http://localhost:8080/api";

const form=document.getElementById("offerForm");

form.addEventListener("submit",async(e)=>{

e.preventDefault();

const data={

restaurantName:
document.getElementById("restaurantName").value,

foodName:
document.getElementById("foodName").value,

foodDescription:
document.getElementById("foodDescription").value,

quantity:
Number(document.getElementById("quantity").value),

foodPrice:
Number(document.getElementById("foodPrice").value),

deliveryCharge:
Number(document.getElementById("deliveryCharge").value),

startTime:
document.getElementById("startTime").value,

endTime:
document.getElementById("endTime").value,

maxPeople:
Number(document.getElementById("maxPeople").value)

};

try{

const res=await fetch(

API+"/offers",

{

method:"POST",

credentials:"include",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify(data)

}

);

const result=await res.json();

alert(result.message);

}catch(err){

alert("Failed to create offer.");

console.error(err);

}

});