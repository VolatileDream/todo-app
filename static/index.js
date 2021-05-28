var state = [];

// Wrap $.ajay just a little to be more convenient.
var req = function(settings) {
  if (settings['data']) {
    settings['contentType'] = 'application/json';
    settings['data'] = JSON.stringify(settings['data']);
  }
  settings['async'] = false;
  return $.ajax(settings)
}

var TODOS = {
  add : function(content) {
    var todo = req({
      method: 'POST',
      url: '/api/add',
      data: { content: content },
    }).responseJSON;
    return {id: todo.rowid, content: todo.content, done: Boolean(todo.done)};
  },
  list : function() {
    var response = req({
      method: 'GET',
      url: '/api/list',
    }).responseJSON;

    // Reconstruct the ordered list.
    var todos = {}
    for (t of response.todos) {
      todos[t.rowid] = t
    }

    var items = []
    var next = response.first
    while (next) {
      t = todos[next]
      items.push({id: t.rowid, content: t.content, done: Boolean(t.done)})
      next = t.next
    }
    return items;
  },
  update: function(id, content, done, prev, next) {
    var response = req({
      method: 'POST',
      url: '/api/update/' + id,
      data: {
        content: content,
        done: done,
        prev: prev,
        next: next,
      },
    }).responseJSON;
  },
  rm : function(id) {
    return req({
      method: 'POST',
      url: '/api/delete/' + id,
    }).responseJSON;
  },
};

function setDefaultState() {
  var id = generateID();
  var baseState = {};
  baseState[id] = {
    status: "new",
    id: id,
    title: "Todost uses 🍪 to track your tasks !"
  };
  syncState(baseState);
}

function generateID() {
  var randLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return randLetter + Date.now();
}

function pushToState(title, status, id) {
  var baseState = getState();
  baseState[id] = { id: id, title: title, status: status };
  syncState(baseState);
}

function setToDone(id) {
  var baseState = getState();
  if (baseState[id].status === 'new') {
    baseState[id].status = 'done'
  } else {
    baseState[id].status =  'new';
  }

  syncState(baseState);
}

function deleteTodo(id) {
  console.log(id)
  var baseState = getState();
  delete baseState[id]
  syncState(baseState)
}

function resetState() {
  localStorage.setItem("state", null);
}

function syncState(state) {
  localStorage.setItem("state", JSON.stringify(state));
}

function getState() {
  return JSON.parse(localStorage.getItem("state"));
}

function addItem(text, status, id, noUpdate) {
  var id = id ? id : generateID();
  var c = status === "done" ? "danger" : "";
  var item =
    '<li data-id="' + id + '" class="animated flipInX ' + c + '">' +
    '<div class="checkbox"><span class="close"><i class="fa fa-times"></i></span>' +
      '<label><span class="checkbox-mask"></span><input type="checkbox" />' +
      text +
      '</label>' + 
    '</div></li>';

  var isError = $(".form-control").hasClass("hidden");

  if (text === "") {
    $(".err")
      .removeClass("hidden")
      .addClass("animated bounceIn");
  } else {
    $(".err").addClass("hidden");
    $(".todo-list").append(item);
  }

  $(".no-items").addClass("hidden");

  $(".form-control")
    .val("")
    .attr("placeholder", "✍️ Add item...");
  setTimeout(function() {
    allTodoLIs().removeClass("animated flipInX");
  }, 500);

  if (!noUpdate) {
    pushToState(text, "new", id);
  }
}

function moveTodo(prev, current) {

}

function toggleListItem(li) {
  li.toggleClass("danger")
  li.toggleClass("animated flipInX");

  setTimeout(function() {
    li.removeClass("animated flipInX");
  }, 500);
}

function allTodoLIs() {
  return $(".todo-list li")
}

$(function() {
  var err = $(".err"),
    formControl = $(".form-control"),
    isError = formControl.hasClass("hidden");

  if (!isError) {
    formControl.blur(function() {
      err.addClass("hidden");
    });
  }

  $(".add-btn").on("click", function() {
    var itemVal = $(".form-control").val();
    addItem(itemVal);
    formControl.focus();
  });

  $("#show-done").on("click", 'input[type="checkbox"]', function() {
    todos = $(".todo-list")
    todos.toggleClass("hide-done")

    var li = $("#show-done");
    toggleListItem(li);
  });

  $(".todo-list").on("click", 'input[type="checkbox"]', function() {
    var li = $(this)
      .parent()
      .parent()
      .parent();
    setToDone(li.data().id);

    toggleListItem(li);
  });

  $(".todo-list").on("click", ".close", function() {
    var box = $(this)
      .parent()
      .parent();

    if (allTodoLIs().length == 1) {
      box.removeClass("animated flipInX").addClass("animated bounceOutLeft");
      setTimeout(function() {
        box.remove();
        $(".no-items").removeClass("hidden");
      }, 500);
    } else {
      box.removeClass("animated flipInX").addClass("animated bounceOutLeft");
      setTimeout(function() {
        box.remove();
      }, 500);
    }

    deleteTodo(box.data().id)
  });

  $(".form-control").keypress(function(e) {
    if (e.which == 13) {
      var itemVal = $(".form-control").val();
      addItem(itemVal);
    }
  });
  $(".todo-list").sortable();
  $(".todo-list").disableSelection();

  allTodoLIs()

  $(".todo-list").sortable({
    start: function(_event, ui) {
      ui.item.data("sort-pos", ui.item.index());
    },
    update: function(_event, ui) {
      console.log(ui.item.data("sort-pos"), ui.item.index())
      moveTodo(ui.item.data("sort-pos"), ui.item.index())
      ui.item.data("sport-pos", null)
    },
  })
});

var todayContainer = document.querySelector(".today");

var d = new Date();

var weekday = new Array(7);
weekday[0] = "Sunday 🖖";
weekday[1] = "Monday 💪😀";
weekday[2] = "Tuesday 😜";
weekday[3] = "Wednesday 😌☕️";
weekday[4] = "Thursday 🤗";
weekday[5] = "Friday 🍻";
weekday[6] = "Saturday 😴";

var n = weekday[d.getDay()];

var randomWordArray = Array(
  "Oh my, it's ",
  "Whoop, it's ",
  "Happy ",
  "Seems it's ",
  "Awesome, it's ",
  "Have a nice ",
  "Happy fabulous ",
  "Enjoy your "
);

var randomWord = randomWordArray[Math.floor(Math.random() * randomWordArray.length)];

todayContainer.innerHTML = randomWord + n;

$(document).ready(function() {
  var state = getState();

  if (!state) {
    setDefaultState();
    state = getState();
  }

  Object.keys(state).forEach(function(todoKey) {
    var todo = state[todoKey];
    addItem(todo.title, todo.status, todo.id, true);
  });
});

