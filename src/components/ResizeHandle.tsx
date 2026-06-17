interface ResizeHandleProps {
  on_resize: (cursor_x: number) => void;
}

export function ResizeHandle({ on_resize }: ResizeHandleProps) {
  function start() {
    document.body.classList.add("resizing");

    function move(event: MouseEvent) {
      on_resize(event.clientX);
    }

    function stop() {
      document.body.classList.remove("resizing");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    }

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  }

  return (
    <div
      className="resize-handle"
      onMouseDown={(event) => {
        event.preventDefault();
        start();
      }}
    />
  );
}
