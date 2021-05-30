var _todos;
var _todoMap;

// Wrap $.ajax just a little to be more convenient.
var req = function(settings) {
  if (settings['data']) {
    settings['contentType'] = 'application/json';
    settings['data'] = JSON.stringify(settings['data']);
  }
  settings['async'] = false;
  return $.ajax(settings)
}

function strip_prev_next(t) {
  delete t["next"]
  delete t["prev"]
  return t;
}

// API
var API = {
  add : function(content) {
    return strip_prev_next(req({
      method: 'POST',
      url: '/api/add',
      data: { content: content },
    })).responseJSON;
  },
  list : function() {
    var response = req({
      method: 'GET',
      url: '/api/list',
    }).responseJSON;

    // Reconstruct the ordered list.
    var todos = {};
    response.todos.forEach(function(t) {
      todos[t.id] = t;
    });

    var items = [];
    var next = response.first;
    while (next) {
      t = todos[next];
      next = t.next;
      items.push(strip_prev_next(t));
    }
    return items;
  },
  done: function(todo) {
    // Don't provide prev/next, because we don't have to.
    return strip_prev_next(req({
      method: 'POST',
      url: '/api/update/' + todo.id,
      data: {
        content: todo.content,
        done: todo.done,
      },
    })).responseJSON;
  },
  move: function(todo) {
    return strip_prev_next(req({
      method: 'POST',
      url: '/api/update/' + todo.id,
      data: {
        prev: todo.prev,
        next: todo.next,
      },
    })).responseJSON;
  },
  rm : function(id) {
    return strip_prev_next(req({
      method: 'POST',
      url: '/api/delete/' + id,
    })).responseJSON;
  },
};

function indexIdOrNull(items, index) {
  if (0 <= index && index < items.length) {
    return items[index].id
  }
  return null;
}

function toggleListItem(li) {
  li.toggleClass("danger")
  li.toggleClass("animated flipInX");

  setTimeout(function() {
    li.removeClass("animated flipInX");
  }, 500);
}

function liID(li) {
  // remove 'id-' prefix
  return li.data().id.substring(3)
}

function allTodoLIs() {
  return $(".todo-list li")
}

function weekdayUpdater() {
  var weekday = new Array(7);
  weekday[0] = "Sunday 🖖";
  weekday[1] = "Monday 💪😀";
  weekday[2] = "Tuesday 😜";
  weekday[3] = "Wednesday 😌☕️";
  weekday[4] = "Thursday 🤗";
  weekday[5] = "Friday 🍻";
  weekday[6] = "Saturday 😴";

  var d = new Date();
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

  var todayContainer = document.querySelector(".today");
  todayContainer.innerHTML = randomWord + n;
};

$(document).ready(function() {
  weekdayUpdater();

  var err = $(".err"),
    formControl = $(".form-control"),
    todoList = $(".todo-list"),
    noItems = $(".no-items"),
    doneControl = $("#show-done");

  // Remove error class when the input control loses focus.
  formControl.blur(function() {
    err.addClass("hidden");
  });

  _todos = [];
  _todoMap = {};

  function todo_add(todo) {
    console.log("adding todo:", todo);
    var cls = (todo.done ? "danger" : "");
    // id is prefixed with 'id-' to ensure no javascript integer parsing.
    var html =
      '<li data-id="id-' + todo.id + '" class="animated flipInX ' + cls + '">' +
      '<div class="checkbox"><span class="close"><i class="fa fa-times"></i></span>' +
        '<label><span class="checkbox-mask"></span><input type="checkbox" />' +
        todo.content +
        '</label>' + 
      '</div></li>';

    noItems.addClass("hidden");
    todoList.append(html);

    _todos.push(todo);
    _todoMap[todo.id] = todo;

    // Remove animation, so it can be done again later.
    setTimeout(function() {
      allTodoLIs().removeClass("animated flipInX");
    }, 500);
  };
  function todo_create() {
    var itemVal = formControl.val();
    if (itemVal === "") {
      err.removeClass("hidden").addClass("animated bounceIn");
      return;
    }
    err.addClass("hidden");

    var todo = API.add(itemVal);
    todo_add(todo);

    // Update the input form.
    formControl
      .val("")
      .attr("placeholder", "✍️ Add item...")
      .focus();
  };
  function todo_done(todoLI) {
    var id = liID(todoLI);
    var todo = _todoMap[id];

    todo.done = !todo.done;
    API.done(todo);

    toggleListItem(todoLI);
  };
  function todo_move(todoLI, new_index) {
    var id = liID(todoLI);
    var todo = _todoMap[id];

    var prev_index = _todos.indexOf(todo);
    if (prev_index == new_index) {
      return;
    }

    _todos.splice(prev_index, 1);
    _todos.splice(new_index, 0, todo);

    var move = {
      id: todo.id,
      prev: indexIdOrNull(_todos, new_index - 1),
      next: indexIdOrNull(_todos, new_index + 1),
    };

    API.move(move);
  };
  function todo_rm(todoLI) {
    var id = liID(todoLI);
    var todo = _todoMap[id];
    var index = _todos.indexOf(todo);
    API.rm(todo.id)

    delete _todoMap[todo.id];
    _todos.splice(index, 1);

    var empty = _todos.length == 0;

    todoLI.removeClass("animated flipInX").addClass("animated bounceOutLeft");
    setTimeout(function() {
      todoLI.remove();
      if (empty) {
        noItems.removeClass("hidden");
      }
    }, 500);
  };

  $(".add-btn").on("click", todo_create);
  formControl.keypress(function(e) {
    if (e.which == 13) {
      todo_create();
    }
  });

  doneControl.on("click", 'input[type="checkbox"]', function() {
    todoList.toggleClass("hide-done")
    toggleListItem(doneControl);
  });

  todoList.on("click", 'input[type="checkbox"]', function() {
    var li = $(this)
      .parent()
      .parent()
      .parent();
    todo_done(li);
  });

  todoList.on("click", ".close", function() {
    var box = $(this)
      .parent()
      .parent();
    todo_rm(box);
  });

  todoList.sortable();
  todoList.sortable({
    update: function(_event, ui) {
      var new_index = ui.item.index();
      todo_move(ui.item, new_index);
    },
  });
  todoList.disableSelection();

  // Now to the actual setting of the UI the first time.
  API.list().forEach(todo_add);
});

