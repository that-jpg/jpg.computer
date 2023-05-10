#!/usr/local/bin/elixir
defmodule Serializer do
  def serialize_file(file_path, data) do
    # Serialize the data
    binary = :erlang.term_to_binary(data)

    # Write the serialized data to a file
    File.write(file_path, binary)
  end

  def deserialize_file(file_path) do
    # Check if the file exists
    if File.exists?(file_path) do
      # Read the serialized data from the file
      {:ok, binary} = File.read(file_path)

      # Deserialize the data
      :erlang.binary_to_term(binary)
    else
      # If the file doesn't exist, return an empty list
      []
    end
  end

  def add_item_to_file(file_path) do
    # Deserialize the data from the file
    data = deserialize_file(file_path)
    # Prompt the user to enter values for a new item
    name = IO.gets("Enter name: ") |> String.trim()
    location = IO.gets("Enter location: ") |> String.trim()
    grade = IO.gets("Enter grade: ") |> String.trim()
    type = IO.gets("Enter type: ") |> String.trim()
    date = IO.gets("Enter date: ") |> String.trim()
    description = IO.gets("Enter description: ") |> String.trim()

    # Add the new item to the data
    new_item = %{
      name: name,
      location: location,
      grade: grade,
      type: type,
      date: date,
      description: description,
      id: length(data)
    }
    updated_data = [new_item | data]
    IO.inspect(updated_data)

    # Serialize the updated data and write it to the file
    serialize_file(file_path, updated_data)
  end
end

# Usage example
Serializer.add_item_to_file("database.bin")
