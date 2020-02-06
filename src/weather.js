import { fromEvent, BehaviorSubject, Subject, from, combineLatest } from "rxjs";
import { tap, debounceTime, switchMap, skipWhile, pluck } from "rxjs/operators";
import { add } from "./helpers";
import { ajax } from "rxjs/ajax";

const lastSearch = localStorage.getItem("lastSearch");
const firstTerm = lastSearch !== undefined ? lastSearch : "";

const searchBox = document.getElementById("search");
const resultBox = document.getElementById("results-container");
const spinner = document.getElementById("spinner");

const searchEvent = fromEvent(searchBox, "keyup");
const resultsEvent = fromEvent(resultBox, "click");

//Subjects

const inputSubject = new BehaviorSubject(firstTerm);
const placeSubject = new Subject();
const weatherSubject = new Subject();

const inputData = inputSubject
  .pipe(
    skipWhile(value => value === null || value.length < 3),
    tap(() => {
      spinner.className = "spinner";
      resultBox.innerHTML = "";
    }),
    debounceTime(1000),
    switchMap(searchTerm =>
      ajax.getJSON(`http://localhost:3000/autocomplete/${searchTerm}`).pipe(
        tap(() => (spinner.className = "")),
        switchMap(results => {
          return from(results);
        })
      )
    )
  )
  .subscribe(result => {
    localStorage.setItem("lastSearch", searchBox.value);
    add.result(result.description, result.place_id);
  });

searchEvent.subscribe(ev => {
  console.log(ev.target.value);
  inputSubject.next(ev.target.value);
});

const placeData = resultsEvent
  .pipe(
    switchMap(ev => {
      const id = ev.target.getAttribute("data");
      return ajax.getJSON(`http://localhost:3000/place/${id}`);
    })
  )
  .subscribe(place => {
    //add.li(place);
    placeSubject.next(place);
  });

const weatherData = placeSubject.pipe(
  tap(place => {
    console.log(place);
  }),
  pluck("geometry", "location"),
  switchMap(coords =>
    ajax
      .getJSON(`http://localhost:3000/weather/${coords.lat}/${coords.lng}`)
      .pipe(pluck("currently"))
  )
);

const fToC = f => ((f - 32) / 1.8).toFixed(1);
const getPhotos = place => {
  if (place.photos) {
    const photoreference = place.photos[0].photo_reference;

    return `<img src="https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoreference}&key=AIzaSyC6FChggqB6PEmOMe729NcCcfsi9iRRIhY" />`;
  } else {
    return "<strong>Nope</strong>";
  }
};
combineLatest(weatherData, placeSubject).subscribe(result => {
  const weather = result[0];
  const place = result[1];
  console.log(result);
  document.getElementById("image-container").innerHTML = "";
  add.div(`
  <div>
  <p>Feels like : ${fToC(weather.apparentTemperature)}&deg;</p>
  <p>Current Conditions : ${weather.summary}</p>
  <p>Change of Rain : ${weather.precipProbability}</p>
  ${getPhotos(place)}
  </div>
  `);
});
