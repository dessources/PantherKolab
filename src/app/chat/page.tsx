import { parameterStore } from "@/lib/parameterStore";
import { useState } from "react";
import { v4 } from "uuid";

export default function async Chat() {
  const [messages, setMessages] = useState<string[]>([]);

 

  const receiveMessageHandler = () => {
    const message = {
      content: "Message id " + v4(), // "Message id dkdk-483-dj587-dj389"
      sender: "senderid",
    };

    setMessages([...messages, message.content]);
  };

  return (
    <div>
      <h1>{loading && "loading..."}</h1>
      <button onClick={sendMessageHandler}></button>

      <ul>
        {messages.map((message, i) => {
          return <li key={i}>{message}</li>;
        })}
      </ul>

      <button onClick={receiveMessageHandler}></button>
    </div>
  );
}
